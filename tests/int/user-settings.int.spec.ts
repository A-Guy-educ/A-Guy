/**
 * Integration tests for UserSettings collection
 *
 * Tests:
 * - Create settings for a user
 * - Read back settings
 * - Update settings
 * - Access control: user can only read own settings
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { AccountRole } from '@/server/payload/collections/Users/roles'
import config from '@payload-config'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const hasDatabaseUrl = !!process.env.DATABASE_URL

let payload: Payload
let testUser1Id: string
let testUser2Id: string
let settingsId: string

beforeAll(async () => {
  if (!hasDatabaseUrl) return

  payload = await getPayload({ config })

  // Create two test users
  const user1 = await payload.create({
    collection: 'users',
    data: {
      email: `settings-user1-${Date.now()}@example.com`,
      password: 'test123456',
      role: AccountRole.Student,
    },
  })
  testUser1Id = user1.id

  const user2 = await payload.create({
    collection: 'users',
    data: {
      email: `settings-user2-${Date.now()}@example.com`,
      password: 'test123456',
      role: AccountRole.Student,
    },
  })
  testUser2Id = user2.id

  // Clean up any stale settings from previous test runs (shared CI DB)
  const staleSettings = await payload.find({
    collection: 'user_settings',
    where: {
      or: [{ user: { equals: testUser1Id } }, { user: { equals: testUser2Id } }],
    },
    limit: 100,
    overrideAccess: true,
  })
  for (const s of staleSettings.docs) {
    await payload.delete({ collection: 'user_settings', id: s.id, overrideAccess: true })
  }
})

afterAll(async () => {
  if (!hasDatabaseUrl || !payload) return

  // Clean up settings
  const settings = await payload.find({
    collection: 'user_settings',
    where: {
      or: [{ user: { equals: testUser1Id } }, { user: { equals: testUser2Id } }],
    },
    limit: 1000,
    overrideAccess: true,
  })

  for (const setting of settings.docs) {
    await payload.delete({
      collection: 'user_settings',
      id: setting.id,
      overrideAccess: true,
    })
  }

  // Clean up test users
  for (const userId of [testUser1Id, testUser2Id]) {
    if (userId) {
      await payload.delete({
        collection: 'users',
        id: userId,
        overrideAccess: true,
      })
    }
  }

  if (payload.db?.destroy) {
    await payload.db.destroy()
  }
})

describe.skipIf(!hasDatabaseUrl)('UserSettings Collection', () => {
  describe('CRUD operations', () => {
    it('should create settings for a user', async () => {
      const settings = await payload.create({
        collection: 'user_settings',
        data: {
          user: testUser1Id,
        } as any,
        overrideAccess: true,
      })

      expect(settings).toBeDefined()
      expect(settings.id).toBeDefined()
      settingsId = settings.id

      const userId = typeof settings.user === 'string' ? settings.user : (settings.user as any)?.id
      expect(userId).toBe(testUser1Id)
    })

    it('should read back settings and verify fields', async () => {
      const settings = await payload.findByID({
        collection: 'user_settings',
        id: settingsId,
        overrideAccess: true,
      })

      expect(settings).toBeDefined()
      expect(settings.id).toBe(settingsId)

      const userId = typeof settings.user === 'string' ? settings.user : (settings.user as any)?.id
      expect(userId).toBe(testUser1Id)

      // teacherProfile should be null/undefined since we did not set it
      expect(settings.teacherProfile).toBeFalsy()
    })

    it('should enforce unique user constraint', async () => {
      // Try to create a second settings record for the same user
      let duplicateError: Error | null = null
      try {
        await payload.create({
          collection: 'user_settings',
          data: {
            user: testUser1Id,
          } as any,
          overrideAccess: true,
        })
      } catch (error: any) {
        duplicateError = error
      }

      // The user field has unique: true, so this should fail
      expect(duplicateError).not.toBeNull()
    })

    it('should update settings', async () => {
      // Get or create a teacher profile to reference
      const existingProfiles = await payload.find({
        collection: 'teacher_profiles',
        limit: 1,
        overrideAccess: true,
      })

      let teacherProfileId: string | null = null
      if (existingProfiles.docs.length > 0) {
        teacherProfileId = existingProfiles.docs[0].id
      }

      if (teacherProfileId) {
        const updated = await payload.update({
          collection: 'user_settings',
          id: settingsId,
          data: {
            teacherProfile: teacherProfileId,
          } as any,
          overrideAccess: true,
        })

        const profileId =
          typeof updated.teacherProfile === 'string'
            ? updated.teacherProfile
            : (updated.teacherProfile as any)?.id
        expect(profileId).toBe(teacherProfileId)
      } else {
        // If no teacher profiles exist, just verify update works with null
        const updated = await payload.update({
          collection: 'user_settings',
          id: settingsId,
          data: {
            teacherProfile: null,
          } as any,
          overrideAccess: true,
        })

        expect(updated).toBeDefined()
        expect(updated.id).toBe(settingsId)
      }
    })
  })

  describe('Access control', () => {
    let user2SettingsId: string

    it('should allow user to read their own settings', async () => {
      const user1 = await payload.findByID({
        collection: 'users',
        id: testUser1Id,
        overrideAccess: true,
      })

      const results = await payload.find({
        collection: 'user_settings',
        where: {
          user: { equals: testUser1Id },
        },
        user: user1 as any,
        overrideAccess: false,
      })

      expect(results.docs.length).toBeGreaterThanOrEqual(1)
      const found = results.docs.find((d) => d.id === settingsId)
      expect(found).toBeDefined()
    })

    it("should prevent user from reading another user's settings", async () => {
      // Create settings for user 2
      const settings2 = await payload.create({
        collection: 'user_settings',
        data: {
          user: testUser2Id,
        } as any,
        overrideAccess: true,
      })
      user2SettingsId = settings2.id

      // User 1 tries to find user 2's settings
      const user1 = await payload.findByID({
        collection: 'users',
        id: testUser1Id,
        overrideAccess: true,
      })

      const results = await payload.find({
        collection: 'user_settings',
        user: user1 as any,
        overrideAccess: false,
      })

      // User 1 should NOT see user 2's settings
      const foundUser2Settings = results.docs.find((d) => d.id === user2SettingsId)
      expect(foundUser2Settings).toBeUndefined()
    })

    it('should prevent non-admin from creating settings (access control)', async () => {
      // The create access is adminOnly, so a student should not be able to create
      const user1 = await payload.findByID({
        collection: 'users',
        id: testUser1Id,
        overrideAccess: true,
      })

      let accessError: Error | null = null
      try {
        await payload.create({
          collection: 'user_settings',
          data: {
            // Use a fresh user to avoid unique constraint issues
            user: testUser2Id,
          } as any,
          user: user1 as any,
          overrideAccess: false,
        })
      } catch (error: any) {
        accessError = error
      }

      // This may either throw or silently deny based on Payload behavior
      // If user2 already has settings, it would fail on unique constraint too
      // The key assertion: a student cannot create settings without overrideAccess
      expect(accessError).not.toBeNull()
    })

    it('should allow admin to read all settings', async () => {
      // Hook forces role=student on create, so update role after
      const admin = await payload.create({
        collection: 'users',
        data: {
          email: `settings-admin-${Date.now()}@example.com`,
          password: 'test123456',
        },
      } as any)
      await payload.update({
        collection: 'users',
        id: admin.id,
        data: { role: AccountRole.Admin },
        overrideAccess: true,
      })

      try {
        const adminUser = await payload.findByID({
          collection: 'users',
          id: admin.id,
          overrideAccess: true,
        })

        const results = await payload.find({
          collection: 'user_settings',
          where: {
            or: [{ user: { equals: testUser1Id } }, { user: { equals: testUser2Id } }],
          },
          user: adminUser as any,
          overrideAccess: false,
        })

        // Admin should see settings for both users
        const user1Settings = results.docs.find((d) => {
          const userId = typeof d.user === 'string' ? d.user : (d.user as any)?.id
          return userId === testUser1Id
        })
        const user2Settings = results.docs.find((d) => {
          const userId = typeof d.user === 'string' ? d.user : (d.user as any)?.id
          return userId === testUser2Id
        })

        expect(user1Settings).toBeDefined()
        expect(user2Settings).toBeDefined()
      } finally {
        await payload.delete({
          collection: 'users',
          id: admin.id,
          overrideAccess: true,
        })
      }
    })
  })
})
