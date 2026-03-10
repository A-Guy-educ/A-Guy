/**
 * Guest Session Upgrade Service
 * Transfers guest conversations to authenticated users on login/register
 *
 * @fileType service
 * @domain auth
 * @pattern ownership-transfer
 * @ai-summary Atomic transfer of guest conversations to user account
 *
 * Security:
 * - Atomic lock: claim acquires exclusive lock before transfer (S7)
 * - Session revoked after transfer (prevents reuse)
 * - Cookie cleared to prevent ambiguity
 * - Idempotent: safe to retry after partial failure
 */
import type { Payload } from 'payload'
import { logger } from '@/infra/utils/logger'
import {
  acquireClaimLock,
  completeClaimLock,
  getGuestSessionByTokenForClaim,
  clearGuestSessionCookie,
} from './guest-session'

/**
 * Data type for updating a conversation to claim it for a user
 */
interface ClaimConversationData {
  user: string
  guestSession: null
}

/**
 * Error thrown when guest session is already being claimed by another user
 */
export class GuestSessionClaimingInProgressError extends Error {
  constructor() {
    super('Guest session is currently being claimed by another user. Please try again.')
    this.name = 'GuestSessionClaimingInProgressError'
  }
}

/**
 * Result of claiming guest conversations
 */
export interface ClaimResult {
  claimed: number
  headers: Headers
  resumed?: boolean
}

/**
 * Claim guest conversations for an authenticated user
 * Uses lock-based idempotent flow to prevent race conditions and orphaning
 */
export async function claimGuestConversations(
  payload: Payload,
  userId: string,
  sessionToken: string,
  headers: Headers = new Headers(),
): Promise<ClaimResult> {
  // Step 1: Resolve session - find active or claiming session
  const session = await getGuestSessionByTokenForClaim(payload, sessionToken)
  if (!session) {
    // Session not found or expired - no-op success, clear cookie anyway
    logger.debug({ userId }, 'Guest session not found during claim')
    clearGuestSessionCookie(headers)
    return { claimed: 0, headers }
  }

  // Step 2: Acquire claim lock
  const lockResult = await acquireClaimLock(payload, session.id, userId)

  if (lockResult.alreadyCompleted) {
    // Already claimed by someone - no-op success
    logger.debug({ userId, sessionId: session.id }, 'Guest session already claimed')
    clearGuestSessionCookie(headers)
    return { claimed: 0, headers }
  }

  if (lockResult.inProgress) {
    // Different user is claiming - return error for retry
    logger.warn(
      { userId, sessionId: session.id },
      'Guest session claim in progress by different user',
    )
    throw new GuestSessionClaimingInProgressError()
  }

  // Lock acquired (fresh or resumed)
  const isResumed = lockResult.resumed === true

  // Step 3: Find all conversations to transfer
  const conversations = await payload.find({
    collection: 'conversations',
    where: {
      and: [{ guestSession: { equals: session.id } }, { archivedAt: { exists: false } }],
    },
    limit: 1000, // Higher limit for bulk transfer
    depth: 0,
  })

  const conversationCount = conversations.docs.length

  if (conversationCount === 0) {
    // No conversations to transfer - just complete the lock
    await completeClaimLock(payload, session.id, userId)
    clearGuestSessionCookie(headers)
    logger.info({ userId, sessionId: session.id }, 'Guest session claimed (no conversations)')
    return { claimed: 0, headers }
  }

  logger.info(
    { userId, sessionId: session.id, count: conversationCount, resumed: isResumed },
    'Claiming guest conversations',
  )

  // Step 4: Bulk transfer conversations
  // Use bulk update with where clause for efficiency
  await payload.update({
    collection: 'conversations',
    where: {
      and: [{ guestSession: { equals: session.id } }, { archivedAt: { exists: false } }],
    },
    data: {
      user: userId,
      guestSession: null,
    } as ClaimConversationData,
    overrideAccess: true,
  })

  // Step 5: Verify zero remaining conversations before revocation
  const remaining = await payload.count({
    collection: 'conversations',
    where: {
      and: [{ guestSession: { equals: session.id } }, { archivedAt: { exists: false } }],
    },
  })

  if (remaining.totalDocs > 0) {
    // Safety: don't revoke if conversations still exist (leave for retry)
    logger.error(
      { userId, sessionId: session.id, remaining: remaining.totalDocs },
      'Failed to transfer all conversations - leaving session in claiming state for retry',
    )
    // Don't clear cookie - allow retry
    return { claimed: -1, headers }
  }

  // Step 6: Complete the lock (transition to revoked)
  await completeClaimLock(payload, session.id, userId)

  // Clear cookie only after successful completion
  clearGuestSessionCookie(headers)

  logger.info(
    { userId, sessionId: session.id, claimed: conversationCount, resumed: isResumed },
    'Guest conversations claimed successfully',
  )

  return { claimed: conversationCount, headers, resumed: isResumed }
}

export async function hasPendingGuestConversations(
  payload: Payload,
  sessionToken: string,
): Promise<boolean> {
  const session = await getGuestSessionByTokenForClaim(payload, sessionToken)
  if (!session) return false

  const conversations = await payload.count({
    collection: 'conversations',
    where: {
      and: [{ guestSession: { equals: session.id } }, { archivedAt: { exists: false } }],
    },
  })

  return conversations.totalDocs > 0
}
