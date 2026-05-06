'use server'

/**
 * Admin Password Recovery Action
 *
 * Provides a controlled path for an admin to reset another user's password
 * by email. Built primarily to recover users whose hash/salt was corrupted
 * by the historical OAuth password-swap bug (PR #1137, fixed in a8f55db3).
 * The fix prevents new corruption, but already-affected users have no
 * recovery path on their own — `payload.login` rejects them, and the
 * project does not yet expose a forgot-password flow.
 *
 * Contract:
 *   - Caller must be an admin (verified by reading their user record with
 *     overrideAccess: true so we don't depend on the request auth context).
 *   - Target is identified by email (the field the user knows, regardless
 *     of what their stored hash/salt currently look like).
 *   - newPassword must meet a minimum strength bar (matches signup_schemas).
 *   - Calls payload.update with overrideAccess: true; Payload regenerates
 *     hash/salt from the new password as part of normal auth handling.
 *   - Never echoes the new password into logs.
 */

import { getPayload } from 'payload'
import config from '@payload-config'

import { AccountRole } from '@/server/payload/collections/Users/roles'
import { logger } from '@/infra/utils/logger'

export interface AdminResetPasswordInput {
  adminUserId: string
  targetUserEmail: string
  newPassword: string
}

export type AdminResetPasswordError =
  | 'invalid_input'
  | 'forbidden'
  | 'user_not_found'
  | 'weak_password'
  | 'unexpected_error'

export interface AdminResetPasswordResult {
  success: boolean
  error?: AdminResetPasswordError
}

const MIN_PASSWORD_LENGTH = 8

export async function adminResetUserPassword(
  input: AdminResetPasswordInput,
): Promise<AdminResetPasswordResult> {
  if (
    !input ||
    typeof input.adminUserId !== 'string' ||
    typeof input.targetUserEmail !== 'string' ||
    typeof input.newPassword !== 'string' ||
    input.adminUserId.length === 0 ||
    input.targetUserEmail.length === 0
  ) {
    return { success: false, error: 'invalid_input' }
  }

  if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
    return { success: false, error: 'weak_password' }
  }

  try {
    const payload = await getPayload({ config })

    // Verify caller is admin. Use overrideAccess so this works regardless of
    // the calling request's auth context — the gate is the explicit role check.
    let admin: { role?: string | null } | null = null
    try {
      admin = (await payload.findByID({
        collection: 'users',
        id: input.adminUserId,
        overrideAccess: true,
        depth: 0,
      })) as { role?: string | null } | null
    } catch {
      // Treat any lookup failure (NotFound, invalid id) as forbidden — never
      // reveal whether the caller's id exists.
      return { success: false, error: 'forbidden' }
    }

    if (!admin || admin.role !== AccountRole.Admin) {
      return { success: false, error: 'forbidden' }
    }

    // Resolve target user by email.
    const target = await payload.find({
      collection: 'users',
      where: { email: { equals: input.targetUserEmail } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (target.docs.length === 0) {
      return { success: false, error: 'user_not_found' }
    }

    const targetUser = target.docs[0] as { id: string }

    // Force-reset the password. Payload regenerates hash/salt automatically.
    await payload.update({
      collection: 'users',
      id: targetUser.id,
      data: {
        password: input.newPassword,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- password isn't on the public Update type
      } as any,
      overrideAccess: true,
    })

    logger.info(
      {
        adminId: input.adminUserId,
        targetUserId: targetUser.id,
        targetUserEmail: input.targetUserEmail,
        action: 'admin_password_reset',
      },
      'Admin reset user password',
    )

    return { success: true }
  } catch (error) {
    logger.error(
      {
        err: error,
        adminId: input.adminUserId,
        targetUserEmail: input.targetUserEmail,
        action: 'admin_password_reset_failed',
      },
      'Admin password reset failed unexpectedly',
    )
    return { success: false, error: 'unexpected_error' }
  }
}
