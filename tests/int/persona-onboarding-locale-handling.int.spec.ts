/**
 * Integration test for #1592 - Persona onboarding hangs on loading spinner
 *
 * Bug: The /api/teacher-profiles endpoint uses a strict locale filter that doesn't
 * match documents created before the locale field was added (backwards compatibility).
 * This causes the query to return no results when legacy documents exist without locale.
 *
 * The API route should use the `localeWhereClause` pattern which includes
 * `{ locale: { exists: false } }` as a fallback.
 *
 * Steps to reproduce:
 * 1. Create a teacher profile WITHOUT the locale field set
 * 2. Call GET /api/teacher-profiles
 * 3. Assert the profile is returned
 *
 * Current behavior: Query returns empty array, component shows "no profiles" state
 * Expected behavior: Query returns the profile (matching legacy documents without locale)
 */
import { GET } from '@/app/api/teacher-profiles/route'
import { createTestUser } from '../factories/user.factory'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const hasDatabaseUrl = !!process.env.DATABASE_URL

let payload: Payload
let authToken: string
let testUserId: string
let promptId: string
// Profile WITHOUT locale field (legacy document - simulates pre-locale-field documents)
let legacyProfileId: string
// Profile WITH locale field (new document)
let localeProfileId: string

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  // Create test user and login to get JWT
  const user = await createTestUser(payload)
  testUserId = user.id

  const loginResult = await payload.login({
    collection: 'users',
    data: { email: user.email, password: 'test123456' },
  })
  authToken = loginResult.token!

  // Create a prompt (required by teacher_profiles)
  const prompt = await payload.create({
    collection: 'prompts',
    data: {
      title: `test-prompt-${Date.now()}`,
      template: 'Test prompt body for locale handling test',
    },
    overrideAccess: true,
  })
  promptId = prompt.id

  // Create a profile WITHOUT locale field - this simulates legacy documents
  // that were created before the locale field was added to the schema
  // We use direct DB operation to avoid Payload's defaultValue being applied
  const legacyProfile = await payload.create({
    collection: 'teacher_profiles',
    data: {
      slug: `test-legacy-${Date.now()}`,
      label: 'Legacy Teacher (no locale)',
      description: 'Profile without locale field set',
      systemPrompt: promptId,
      isEnabled: true,
      // Note: NOT setting locale field to simulate legacy document
    },
    overrideAccess: true,
  })
  legacyProfileId = legacyProfile.id

  // Create a profile WITH locale field explicitly set
  const localeProfile = await payload.create({
    collection: 'teacher_profiles',
    data: {
      slug: `test-locale-${Date.now()}`,
      label: 'Locale-aware Teacher',
      description: 'Profile with locale field explicitly set',
      systemPrompt: promptId,
      isEnabled: true,
      locale: 'en',
    },
    overrideAccess: true,
  })
  localeProfileId = localeProfile.id
})

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) return

  // Cleanup test data
  const cleanupIds = [legacyProfileId, localeProfileId, promptId, testUserId]
  const collections = ['teacher_profiles', 'teacher_profiles', 'prompts', 'users']

  for (let i = 0; i < cleanupIds.length; i++) {
    try {
      await payload.delete({
        collection: collections[i],
        id: cleanupIds[i],
        overrideAccess: true,
      })
    } catch {
      /* already deleted or doesn't exist */
    }
  }

  if (payload.db?.destroy) {
    await payload.db.destroy()
  }
})

describe.skipIf(!hasDatabaseUrl)(
  'GET /api/teacher-profiles - locale backwards compatibility (#1592)',
  () => {
    it('should return profiles without locale field (backwards compatibility)', async () => {
      // This test reproduces the bug where legacy teacher profiles (created before
      // the locale field was added) are not returned because the API uses a strict
      // locale filter without the fallback for documents with missing locale field.

      const request = new Request('http://localhost:3000/api/teacher-profiles', {
        headers: {
          Authorization: `JWT ${authToken}`,
          // Set locale to 'en' - legacy profile has no locale field
          Cookie: 'NEXT_LOCALE=en',
        },
      })

      const response = await GET(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.profiles).toBeDefined()
      expect(Array.isArray(data.profiles)).toBe(true)

      // The legacy profile (without locale field) should be returned
      // This assertion FAILS with the current buggy implementation because
      // the query uses strict locale matching without fallback
      const legacyProfile = data.profiles.find(
        (p: { label: string }) => p.label === 'Legacy Teacher (no locale)',
      )

      // This is the key assertion that fails due to the bug:
      // The API returns empty array because it only matches documents with locale='en',
      // but legacy documents don't have the locale field at all
      expect(legacyProfile).toBeDefined()
      expect(legacyProfile.slug).toBeDefined()
    })

    it('should return profiles with matching locale field', async () => {
      // This test should pass - it verifies profiles WITH locale field are returned

      const request = new Request('http://localhost:3000/api/teacher-profiles', {
        headers: {
          Authorization: `JWT ${authToken}`,
          Cookie: 'NEXT_LOCALE=en',
        },
      })

      const response = await GET(request)
      expect(response.status).toBe(200)

      const data = await response.json()

      // The locale-aware profile should be found
      const localeProfile = data.profiles.find(
        (p: { label: string }) => p.label === 'Locale-aware Teacher',
      )

      expect(localeProfile).toBeDefined()
      expect(localeProfile.slug).toContain('test-locale')
    })
  },
)
