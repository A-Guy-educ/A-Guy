/**
 * Integration tests: Teacher Profile Resolution
 * Covers: resolveTeacherProfile — 4-tier resolution chain
 *
 * P1 — correctness: if tier fallback is broken, users get a generic hardcoded
 * teacher prompt instead of their configured one, silently degrading UX.
 *
 * Resolution order:
 *   Tier 1 (user-settings)  → user's explicitly selected profile
 *   Tier 2 (default-config) → profile with slug 'teacher_focused'
 *   Tier 3 (first-active)   → any enabled profile (authenticated users only)
 *   Tier 4 (failsafe)       → hardcoded fallback prompt
 *
 * Admin creation note: ensureRoleOnSignup forces role='student' on create;
 * use two-step pattern to promote if needed. For these tests, student users suffice.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { resolveTeacherProfile } from '@/server/services/teacher-profile-resolver'

let payload: Payload
let originalDatabaseUrl: string | undefined

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })
}, 120_000)

afterAll(async () => {
  if (payload?.db?.destroy) await payload.db.destroy()
  await stopMongoContainer()

  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error: TypeScript doesn't allow delete on process.env
    delete process.env.DATABASE_URL
  }
}, 120_000)

/** Clean all teacher-related data to isolate tier resolution */
async function wipeTeacherData() {
  const profiles = await payload.find({
    collection: 'teacher_profiles',
    limit: 100,
    overrideAccess: true,
  })
  for (const p of profiles.docs)
    await payload.delete({ collection: 'teacher_profiles', id: p.id, overrideAccess: true })

  const prompts = await payload.find({ collection: 'prompts', limit: 100, overrideAccess: true })
  for (const p of prompts.docs)
    await payload.delete({ collection: 'prompts', id: p.id, overrideAccess: true })

  const settings = await payload.find({
    collection: 'user_settings',
    limit: 100,
    overrideAccess: true,
  })
  for (const s of settings.docs)
    await payload.delete({ collection: 'user_settings', id: s.id, overrideAccess: true })

  const users = await payload.find({ collection: 'users', limit: 100, overrideAccess: true })
  for (const u of users.docs)
    await payload.delete({ collection: 'users', id: u.id, overrideAccess: true })
}

// Wipe before each test to clear seeded data (TeacherProfilesSeed runs on Payload init)
beforeEach(wipeTeacherData)
afterEach(wipeTeacherData)

async function createPublishedPrompt(template = 'You are a helpful AI teacher.') {
  const ts = Date.now()
  return payload.create({
    collection: 'prompts',
    data: {
      title: `Test Prompt ${ts}`,
      type: 'system',
      template,
      status: 'published',
    } as any,
    overrideAccess: true,
  })
}

async function createTeacherProfile(slug: string, promptId: string, isEnabled = true) {
  return payload.create({
    collection: 'teacher_profiles',
    data: {
      slug,
      label: `Teacher ${slug}`,
      systemPrompt: promptId,
      isEnabled,
    } as any,
    overrideAccess: true,
  })
}

describe('resolveTeacherProfile', () => {
  describe('tier 4 — failsafe', () => {
    it('returns failsafe when no teacher profiles exist in the DB', async () => {
      const result = await resolveTeacherProfile(payload, 'nonexistent-user-id')

      expect(result.resolvedFrom).toBe('failsafe')
      expect(result.profileSlug).toBe('failsafe')
      expect(result.promptTemplate.length).toBeGreaterThan(0)
    })

    it('returns failsafe for guests (no userId) when no profiles exist', async () => {
      const result = await resolveTeacherProfile(payload)

      expect(result.resolvedFrom).toBe('failsafe')
    })
  })

  describe('tier 3 — first-active', () => {
    it('returns first active profile when the default slug is absent', async () => {
      const prompt = await createPublishedPrompt('Custom teacher template.')
      await createTeacherProfile(`custom-teacher-${Date.now()}`, prompt.id)

      // Call with a userId so tier 3 is evaluated (guests skip tier 3)
      const result = await resolveTeacherProfile(payload, 'any-user-id')

      expect(result.resolvedFrom).toBe('first-active')
      expect(result.promptTemplate).toBe('Custom teacher template.')
    })

    it('does not apply tier 3 for guests even when active profiles exist', async () => {
      const prompt = await createPublishedPrompt()
      await createTeacherProfile(`active-profile-${Date.now()}`, prompt.id)

      // No userId → guest path skips tier 3
      const result = await resolveTeacherProfile(payload)

      expect(result.resolvedFrom).toBe('failsafe')
    })
  })

  describe('tier 2 — default-config', () => {
    it('returns default profile when teacher_focused slug exists and is enabled', async () => {
      const prompt = await createPublishedPrompt('Default teacher prompt.')
      await createTeacherProfile('teacher_focused', prompt.id)

      const result = await resolveTeacherProfile(payload)

      expect(result.resolvedFrom).toBe('default-config')
      expect(result.profileSlug).toBe('teacher_focused')
      expect(result.promptTemplate).toBe('Default teacher prompt.')
    })

    it('skips tier 2 when teacher_focused profile has a draft (unpublished) prompt', async () => {
      // Create a draft prompt (not published)
      const draftPrompt = await payload.create({
        collection: 'prompts',
        data: {
          title: `Draft Prompt ${Date.now()}`,
          type: 'system',
          template: 'Draft template.',
          status: 'draft',
        } as any,
        overrideAccess: true,
      })
      await createTeacherProfile('teacher_focused', draftPrompt.id)

      // No userId, no other profiles → should fall to failsafe (tier 2 skipped)
      const result = await resolveTeacherProfile(payload)

      expect(result.resolvedFrom).toBe('failsafe')
    })
  })

  describe('tier 1 — user-settings', () => {
    it('returns user-settings profile when the user has one configured', async () => {
      const prompt = await createPublishedPrompt('Personal teacher template.')
      const profile = await createTeacherProfile(`personal-${Date.now()}`, prompt.id)

      // Create user (triggers createUserSettings hook which creates user_settings record)
      const ts = Date.now()
      const user = await (payload as any).create({
        collection: 'users',
        data: {
          email: `resolver-tier1-${ts}@test.com`,
          password: 'test-password-123!',
          name: 'Tier1 User',
        },
      })

      // Find auto-created settings and link the teacher profile
      const existingSettings = await payload.find({
        collection: 'user_settings',
        where: { user: { equals: user.id } },
        overrideAccess: true,
      })
      const settingsId =
        existingSettings.docs.length > 0
          ? existingSettings.docs[0].id
          : (
              await payload.create({
                collection: 'user_settings',
                data: { user: user.id },
                overrideAccess: true,
              })
            ).id

      await payload.update({
        collection: 'user_settings',
        id: settingsId,
        data: { teacherProfile: profile.id },
        overrideAccess: true,
      })

      const result = await resolveTeacherProfile(payload, user.id)

      expect(result.resolvedFrom).toBe('user-settings')
      expect(result.promptTemplate).toBe('Personal teacher template.')
    })

    it('falls through to tier 2 when the user settings profile is disabled', async () => {
      // Disabled profile in user settings
      const disabledPrompt = await createPublishedPrompt('Disabled profile template.')
      const disabledProfile = await createTeacherProfile(
        `disabled-${Date.now()}`,
        disabledPrompt.id,
        false, // isEnabled = false
      )

      // Default profile (tier 2 fallback)
      const defaultPrompt = await createPublishedPrompt('Default fallback template.')
      await createTeacherProfile('teacher_focused', defaultPrompt.id)

      const ts = Date.now()
      const user = await (payload as any).create({
        collection: 'users',
        data: {
          email: `resolver-fallback-${ts}@test.com`,
          password: 'test-password-123!',
          name: 'Fallback User',
        },
      })

      const existingSettings = await payload.find({
        collection: 'user_settings',
        where: { user: { equals: user.id } },
        overrideAccess: true,
      })
      const settingsId =
        existingSettings.docs.length > 0
          ? existingSettings.docs[0].id
          : (
              await payload.create({
                collection: 'user_settings',
                data: { user: user.id },
                overrideAccess: true,
              })
            ).id

      await payload.update({
        collection: 'user_settings',
        id: settingsId,
        data: { teacherProfile: disabledProfile.id },
        overrideAccess: true,
      })

      // Tier 1 skipped (profile disabled) → falls through to tier 2
      const result = await resolveTeacherProfile(payload, user.id)

      expect(result.resolvedFrom).toBe('default-config')
      expect(result.profileSlug).toBe('teacher_focused')
    })
  })
})
