/**
 * Migration: Localize Teacher Profiles
 *
 * Backfills the `locale` field on existing teacher profile documents that were
 * created before the per-locale document pattern was adopted.
 *
 * Existing profiles are assumed to be in the default content locale (Hebrew).
 * The seed creates English translations separately.
 *
 * Idempotent — skips profiles that already have a `locale` value.
 *
 * @fileType migration
 * @domain ai
 * @pattern migration
 * @ai-summary One-time migration to add locale field to existing teacher profiles
 */

import type { Payload } from 'payload'

import { DEFAULT_CONTENT_LOCALE } from '../fields/contentLocale'

export async function localizeTeacherProfiles(
  payload: Payload,
): Promise<{ updated: number; skipped: number; errors: number }> {
  let updated = 0
  let skipped = 0
  let errors = 0

  const allProfiles = await payload.find({
    collection: 'teacher_profiles',
    limit: 1000,
    overrideAccess: true,
  })

  for (const profile of allProfiles.docs) {
    // Skip if already migrated (locale field present)
    if (profile.locale) {
      skipped++
      continue
    }

    try {
      await payload.update({
        collection: 'teacher_profiles',
        id: profile.id,
        data: {
          locale: DEFAULT_CONTENT_LOCALE,
        },
        overrideAccess: true,
      })

      updated++
    } catch {
      payload.logger?.warn(`[localizeTeacherProfiles] Failed to migrate profile ${profile.id}`)
      errors++
    }
  }

  return { updated, skipped, errors }
}

/**
 * onInit wrapper — runs automatically on server startup, idempotent.
 */
export async function runLocalizeTeacherProfilesOnInit(payload: Payload): Promise<void> {
  const { updated, skipped, errors } = await localizeTeacherProfiles(payload)

  if (updated > 0 || errors > 0) {
    payload.logger?.info(
      `[localizeTeacherProfiles] Migrated ${updated} profiles (${skipped} already done, ${errors} errors)`,
    )
  }
}
