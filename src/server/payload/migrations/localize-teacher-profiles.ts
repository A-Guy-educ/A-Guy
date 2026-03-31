/**
 * Migration: Localize Teacher Profiles
 *
 * Converts existing teacher profile documents from the dual-field schema
 * (label_en, label_he, description_en, description_he) to the per-locale
 * document pattern (plain label + description with a locale field).
 *
 * Steps:
 * 1. Drop the legacy unique index on slug (per-locale docs share slugs)
 * 2. For each existing profile without a locale field:
 *    - Set locale to 'he', copy label_he → label, description_he → description
 *    - Create a new English doc with label_en → label, description_en → description
 *
 * Idempotent — skips profiles that already have a locale value.
 *
 * @fileType migration
 * @domain ai
 * @pattern migration
 * @ai-summary One-time migration to convert dual-field teacher profiles to per-locale documents
 */

import type { Payload } from 'payload'

import { DEFAULT_CONTENT_LOCALE } from '../fields/contentLocale'

/** Legacy fields that existed before the per-locale refactor */
interface LegacyTeacherProfile {
  id: string
  slug: string
  label?: string
  label_en?: string
  label_he?: string
  description?: string
  description_en?: string
  description_he?: string
  systemPrompt: string | { id: string }
  isEnabled?: boolean
  locale?: string
}

export async function localizeTeacherProfiles(
  payload: Payload,
): Promise<{ updated: number; created: number; skipped: number; errors: number }> {
  let updated = 0
  let created = 0
  let skipped = 0
  let errors = 0

  // Step 1: Drop the legacy unique index on slug so per-locale docs can share slugs
  try {
    const db = (payload.db as any)?.connection?.db
    if (db) {
      const collection = db.collection('teacher_profiles')
      const indexes = await collection.indexes()
      const slugUniqueIndex = indexes.find((idx: any) => idx.key?.slug && idx.unique === true)
      if (slugUniqueIndex) {
        await collection.dropIndex(slugUniqueIndex.name)
        payload.logger?.info('[localizeTeacherProfiles] Dropped legacy unique index on slug')
      }
    }
  } catch {
    // Index may not exist or DB connection may not be accessible — non-fatal
    payload.logger?.warn(
      '[localizeTeacherProfiles] Could not drop slug unique index (may not exist)',
    )
  }

  // Step 2: Migrate existing profiles
  const allProfiles = await payload.find({
    collection: 'teacher_profiles',
    limit: 1000,
    overrideAccess: true,
  })

  for (const doc of allProfiles.docs) {
    const profile = doc as unknown as LegacyTeacherProfile

    // Skip if already migrated (locale field present)
    if (profile.locale) {
      skipped++
      continue
    }

    try {
      const promptId =
        typeof profile.systemPrompt === 'object' ? profile.systemPrompt.id : profile.systemPrompt

      // Determine Hebrew label/description from legacy fields
      const heLabel = profile.label_he ?? profile.label ?? profile.slug
      const heDescription = profile.description_he ?? profile.description ?? ''

      // Update existing doc as Hebrew source
      await payload.update({
        collection: 'teacher_profiles',
        id: profile.id,
        data: {
          locale: DEFAULT_CONTENT_LOCALE,
          label: heLabel,
          description: heDescription,
        },
        overrideAccess: true,
      })
      updated++

      // Create English translation doc (if not already exists)
      const enLabel = profile.label_en ?? profile.label ?? profile.slug
      const enDescription = profile.description_en ?? profile.description ?? ''

      const existingEn = await payload.find({
        collection: 'teacher_profiles',
        where: {
          and: [{ slug: { equals: profile.slug } }, { locale: { equals: 'en' } }],
        },
        limit: 1,
        overrideAccess: true,
      })

      if (existingEn.docs.length === 0) {
        await payload.create({
          collection: 'teacher_profiles',
          data: {
            slug: profile.slug,
            locale: 'en',
            translatedFrom: profile.id,
            label: enLabel,
            description: enDescription,
            systemPrompt: promptId,
            isEnabled: profile.isEnabled ?? true,
          },
          overrideAccess: true,
        })
        created++
      }
    } catch (err) {
      payload.logger?.warn(
        `[localizeTeacherProfiles] Failed to migrate profile ${profile.id}: ${err}`,
      )
      errors++
    }
  }

  return { updated, created, skipped, errors }
}

/**
 * onInit wrapper — runs automatically on server startup, idempotent.
 */
export async function runLocalizeTeacherProfilesOnInit(payload: Payload): Promise<void> {
  const { updated, created, skipped, errors } = await localizeTeacherProfiles(payload)

  if (updated > 0 || created > 0 || errors > 0) {
    payload.logger?.info(
      `[localizeTeacherProfiles] Migrated ${updated} profiles, created ${created} translations (${skipped} already done, ${errors} errors)`,
    )
  }
}
