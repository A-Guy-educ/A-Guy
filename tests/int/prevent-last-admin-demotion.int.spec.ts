/**
 * Integration tests: Prevent Last Admin Demotion
 * Covers: preventLastAdminDemotion beforeChange hook on Users collection
 *
 * P0 — security/availability: race-condition risk leaves system with zero admins.
 *
 * Note: ensureRoleOnSignup field hook forces role='student' on all create ops,
 * so admin users require two steps: create (→student) then update role to admin
 * with overrideAccess:true (bypasses field-level access control, not hooks).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { AccountRole } from '@/server/payload/collections/Users/roles'

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

/** Two-step admin creation to bypass the ensureRoleOnSignup field hook. */
async function createAdmin(label = '') {
  const ts = Date.now()
  const user = await (payload as any).create({
    collection: 'users',
    data: {
      email: `admin-${ts}${label}@test.com`,
      password: 'test-password-123!',
      name: `Admin ${ts}${label}`,
    },
  })
  return payload.update({
    collection: 'users',
    id: user.id,
    data: { role: AccountRole.Admin },
    overrideAccess: true,
  })
}

async function createStudent() {
  const ts = Date.now()
  return (payload as any).create({
    collection: 'users',
    data: {
      email: `student-${ts}@test.com`,
      password: 'test-password-123!',
      name: `Student ${ts}`,
    },
  })
}

describe('preventLastAdminDemotion hook', () => {
  it('blocks demotion when the user is the only admin', async () => {
    const admin = await createAdmin()

    await expect(
      payload.update({
        collection: 'users',
        id: admin.id,
        data: { role: AccountRole.Student },
        overrideAccess: true,
      }),
    ).rejects.toThrow()

    // Confirm role unchanged
    const unchanged = await payload.findByID({
      collection: 'users',
      id: admin.id,
      overrideAccess: true,
    })
    expect(unchanged.role).toBe(AccountRole.Admin)

    await payload.delete({ collection: 'users', id: admin.id, overrideAccess: true })
  })

  it('allows demotion when another admin exists', async () => {
    const admin1 = await createAdmin('a')
    const admin2 = await createAdmin('b')

    await expect(
      payload.update({
        collection: 'users',
        id: admin1.id,
        data: { role: AccountRole.Student },
        overrideAccess: true,
      }),
    ).resolves.not.toThrow()

    const updated = await payload.findByID({
      collection: 'users',
      id: admin1.id,
      overrideAccess: true,
    })
    expect(updated.role).toBe(AccountRole.Student)

    await payload.delete({ collection: 'users', id: admin1.id, overrideAccess: true })
    await payload.delete({ collection: 'users', id: admin2.id, overrideAccess: true })
  })

  it('does not block role change from student to student', async () => {
    const student = await createStudent()

    await expect(
      payload.update({
        collection: 'users',
        id: student.id,
        data: { role: AccountRole.Student },
        overrideAccess: true,
      }),
    ).resolves.not.toThrow()

    await payload.delete({ collection: 'users', id: student.id, overrideAccess: true })
  })

  it('does not block promoting a student to admin', async () => {
    const admin = await createAdmin('c')
    const student = await createStudent()

    await expect(
      payload.update({
        collection: 'users',
        id: student.id,
        data: { role: AccountRole.Admin },
        overrideAccess: true,
      }),
    ).resolves.not.toThrow()

    const promoted = await payload.findByID({
      collection: 'users',
      id: student.id,
      overrideAccess: true,
    })
    expect(promoted.role).toBe(AccountRole.Admin)

    await payload.delete({ collection: 'users', id: admin.id, overrideAccess: true })
    await payload.delete({ collection: 'users', id: student.id, overrideAccess: true })
  })

  it('blocks demotion of each admin when exactly two admins exist and one is already demoted', async () => {
    const admin1 = await createAdmin('d')
    const admin2 = await createAdmin('e')

    // Demote admin1 — allowed (admin2 remains)
    await payload.update({
      collection: 'users',
      id: admin1.id,
      data: { role: AccountRole.Student },
      overrideAccess: true,
    })

    // Now admin2 is the only admin — demotion must be blocked
    await expect(
      payload.update({
        collection: 'users',
        id: admin2.id,
        data: { role: AccountRole.Student },
        overrideAccess: true,
      }),
    ).rejects.toThrow()

    await payload.delete({ collection: 'users', id: admin1.id, overrideAccess: true })
    await payload.delete({ collection: 'users', id: admin2.id, overrideAccess: true })
  })
})
