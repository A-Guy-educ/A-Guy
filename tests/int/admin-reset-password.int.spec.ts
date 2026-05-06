/**
 * Recovery test for users locked out by the historical OAuth password
 * corruption (PR #1137). Their hash/salt was overwritten by the old
 * password-swap pattern. The fix in oauth_session.ts stops new corruption,
 * but already-affected users have no way back in unless an admin can
 * forcibly reset their password.
 *
 * This test simulates that data state — by writing garbage hash/salt
 * directly into MongoDB — and asserts that adminResetUserPassword
 * regenerates a working hash, so the affected user can log in again.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { ObjectId } from 'mongodb'

import { getSharedPayload } from '../setup/shared-payload'
import { adminResetUserPassword } from '@/app/(frontend)/actions/admin-reset-password-action'

describe('Admin password recovery for users with corrupted hash/salt', () => {
  let payload: Payload
  const createdUserIds: string[] = []
  let adminId: string
  let userEmail: string
  let userId: string

  beforeAll(async () => {
    payload = await getSharedPayload()

    // Seed an admin caller. The ensureRoleOnSignup field hook forces
    // role='student' on create, so we promote via update with overrideAccess.
    const adminEmail = `admin-recovery-${Date.now()}@example.com`
    const admin = (await payload.create({
      collection: 'users',
      data: {
        email: adminEmail,
        password: 'admin-password-abc',
        name: 'Recovery Admin',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    })) as { id: string }
    adminId = admin.id
    createdUserIds.push(adminId)
    await payload.update({
      collection: 'users',
      id: adminId,
      data: { role: 'admin' },
      overrideAccess: true,
    })

    // Seed an affected user with a known original password.
    userEmail = `corrupt-${Date.now()}@example.com`
    const user = (await payload.create({
      collection: 'users',
      data: {
        email: userEmail,
        password: 'original-password-123',
        name: 'Affected User',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    })) as { id: string }
    userId = user.id
    createdUserIds.push(userId)

    // Sanity: original password works before corruption.
    const baseline = await payload.login({
      collection: 'users',
      data: { email: userEmail, password: 'original-password-123' },
    })
    expect(baseline.token).toBeTruthy()

    // Simulate the historical corruption: overwrite hash/salt with garbage,
    // bypassing Payload hooks (mirrors what the old password-swap pattern
    // would leave behind on a failed restore).
    await payload.db.collections.users.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { hash: 'garbage-hash-from-old-bug', salt: 'garbage-salt-from-old-bug' } },
    )

    // Confirm the user is now locked out — original password fails.
    let throws = false
    try {
      await payload.login({
        collection: 'users',
        data: { email: userEmail, password: 'original-password-123' },
      })
    } catch {
      throws = true
    }
    expect(throws).toBe(true)
  })

  afterAll(async () => {
    for (const id of createdUserIds) {
      try {
        await payload.delete({ collection: 'users', id, overrideAccess: true })
      } catch {
        // already removed
      }
    }
  })

  it('admin can reset a corrupted user’s password and login works with the new password', async () => {
    const result = await adminResetUserPassword({
      adminUserId: adminId,
      targetUserEmail: userEmail,
      newPassword: 'recovered-password-456',
    })

    expect(result.success).toBe(true)

    const login = await payload.login({
      collection: 'users',
      data: { email: userEmail, password: 'recovered-password-456' },
    })
    expect(login.token).toBeTruthy()
  })

  it('rejects when caller is not an admin', async () => {
    const studentEmail = `student-${Date.now()}@example.com`
    const student = (await payload.create({
      collection: 'users',
      data: {
        email: studentEmail,
        password: 'student-pw-abc',
        name: 'Student',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    })) as { id: string }
    createdUserIds.push(student.id)

    const result = await adminResetUserPassword({
      adminUserId: student.id,
      targetUserEmail: userEmail,
      newPassword: 'should-not-apply',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('forbidden')

    // Confirm the password was NOT changed: previous reset value still works.
    const login = await payload.login({
      collection: 'users',
      data: { email: userEmail, password: 'recovered-password-456' },
    })
    expect(login.token).toBeTruthy()
  })

  it('returns user_not_found when the target email does not exist', async () => {
    const result = await adminResetUserPassword({
      adminUserId: adminId,
      targetUserEmail: `does-not-exist-${Date.now()}@example.com`,
      newPassword: 'whatever-strong-pw',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('user_not_found')
  })

  it('rejects passwords that fail the minimum-length policy', async () => {
    const result = await adminResetUserPassword({
      adminUserId: adminId,
      targetUserEmail: userEmail,
      newPassword: 'short',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('weak_password')
  })
})
