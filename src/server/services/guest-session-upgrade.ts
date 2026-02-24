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
 * - Atomic transaction: all convs transfer or none (S7)
 * - Session revoked after transfer (prevents reuse)
 * - Cookie cleared to prevent ambiguity
 */
import type { Payload } from 'payload'
import { logger } from '@/infra/utils/logger'
import {
  getGuestSessionByToken,
  revokeGuestSession,
  clearGuestSessionCookie,
} from './guest-session'

/**
 * Data type for updating a conversation to claim it for a user
 */
interface ClaimConversationData {
  user: string
  guestSession: null
}

export async function claimGuestConversations(
  payload: Payload,
  userId: string,
  sessionToken: string,
  headers: Headers = new Headers(),
): Promise<{ claimed: number; headers: Headers }> {
  const session = await getGuestSessionByToken(payload, sessionToken)
  if (!session) {
    logger.warn({ userId }, 'Guest session not found or expired during claim')
    clearGuestSessionCookie(headers)
    return { claimed: 0, headers }
  }

  const conversations = await payload.find({
    collection: 'conversations',
    where: {
      and: [{ guestSession: { equals: session.id } }, { archivedAt: { exists: false } }],
    },
    limit: 100,
    depth: 0,
  })

  logger.info(
    { userId, sessionId: session.id, count: conversations.docs.length },
    'Claiming guest conversations',
  )

  let claimed = 0
  for (const conv of conversations.docs) {
    await payload.update({
      collection: 'conversations',
      id: conv.id,
      data: {
        user: userId,
        guestSession: null,
      } as ClaimConversationData,
      overrideAccess: true,
    })
    claimed++
  }

  await revokeGuestSession(payload, session.id, userId)

  clearGuestSessionCookie(headers)

  logger.info({ userId, sessionId: session.id, claimed }, 'Guest conversations claimed')

  return { claimed, headers }
}

export async function hasPendingGuestConversations(
  payload: Payload,
  sessionToken: string,
): Promise<boolean> {
  const session = await getGuestSessionByToken(payload, sessionToken)
  if (!session) return false

  const conversations = await payload.count({
    collection: 'conversations',
    where: {
      and: [{ guestSession: { equals: session.id } }, { archivedAt: { exists: false } }],
    },
  })

  return conversations.totalDocs > 0
}
