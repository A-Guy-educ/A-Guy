/**
 * Integration tests: User Settings Auto-Creation Hook
 * Covers: createUserSettings afterChange hook on Users collection
 *
 * P1 — availability: without this hook, users have no settings record and
 * the teacher profile resolver cannot persist user preferences.
 *
 * The hook fires on every create operation (via afterChange) and silently
 * swallows errors, so user creation never fails due to settings creation errors.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'

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

describe('createUserSettings hook', () => {
  it('auto-creates a user_settings record when a user is created', async () => {
    const ts = Date.now()
    const user = await (payload as any).create({
      collection: 'users',
      data: {
        email: `hook-create-${ts}@test.com`,
        password: 'test-password-123!',
        name: 'Hook Create Test',
      },
    })

    const settings = await payload.find({
      collection: 'user_settings',
      where: { user: { equals: user.id } },
      overrideAccess: true,
    })

    expect(settings.docs).toHaveLength(1)
    // user field may be populated (object) or a raw ID string depending on depth
    const userId =
      typeof settings.docs[0].user === 'object'
        ? (settings.docs[0].user as any).id
        : settings.docs[0].user
    expect(userId).toBe(user.id)

    // Cleanup
    await payload.delete({
      collection: 'user_settings',
      id: settings.docs[0].id,
      overrideAccess: true,
    })
    await payload.delete({ collection: 'users', id: user.id, overrideAccess: true })
  })

  it('does not create additional user_settings on user update', async () => {
    const ts = Date.now()
    const user = await (payload as any).create({
      collection: 'users',
      data: {
        email: `hook-update-${ts}@test.com`,
        password: 'test-password-123!',
        name: 'Before Update',
      },
    })

    // Trigger afterChange with update operation — hook should be a no-op
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { name: 'After Update' },
      overrideAccess: true,
    })

    const settings = await payload.find({
      collection: 'user_settings',
      where: { user: { equals: user.id } },
      overrideAccess: true,
    })

    // Still exactly one record — update did not create a duplicate
    expect(settings.docs).toHaveLength(1)

    // Cleanup
    await payload.delete({
      collection: 'user_settings',
      id: settings.docs[0].id,
      overrideAccess: true,
    })
    await payload.delete({ collection: 'users', id: user.id, overrideAccess: true })
  })

  it('creates separate user_settings for each new user', async () => {
    const ts = Date.now()
    const userA = await (payload as any).create({
      collection: 'users',
      data: {
        email: `hook-multi-a-${ts}@test.com`,
        password: 'test-password-123!',
        name: 'User A',
      },
    })
    const userB = await (payload as any).create({
      collection: 'users',
      data: {
        email: `hook-multi-b-${ts}@test.com`,
        password: 'test-password-123!',
        name: 'User B',
      },
    })

    const settingsA = await payload.find({
      collection: 'user_settings',
      where: { user: { equals: userA.id } },
      overrideAccess: true,
    })
    const settingsB = await payload.find({
      collection: 'user_settings',
      where: { user: { equals: userB.id } },
      overrideAccess: true,
    })

    expect(settingsA.docs).toHaveLength(1)
    expect(settingsB.docs).toHaveLength(1)
    expect(settingsA.docs[0].id).not.toBe(settingsB.docs[0].id)

    // Cleanup
    await payload.delete({
      collection: 'user_settings',
      id: settingsA.docs[0].id,
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'user_settings',
      id: settingsB.docs[0].id,
      overrideAccess: true,
    })
    await payload.delete({ collection: 'users', id: userA.id, overrideAccess: true })
    await payload.delete({ collection: 'users', id: userB.id, overrideAccess: true })
  })
})
