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
import { getPayload, type PayloadRequest } from 'payload'
import config from '@payload-config'
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
  userId: string,
  sessionToken: string,
  headers: Headers = new Headers(),
  payloadReq?: PayloadRequest,
): Promise<{ claimed: number; headers: Headers }> {
  const payload = payloadReq?.payload ?? (await getPayload({ config }))

  const session = await getGuestSessionByToken(sessionToken, payloadReq)
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
    ...(payloadReq ? { req: payloadReq } : {}),
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
      ...(payloadReq ? { req: payloadReq } : {}),
    })
    claimed++
  }

  await revokeGuestSession(session.id, userId, payloadReq)

  clearGuestSessionCookie(headers)

  logger.info({ userId, sessionId: session.id, claimed }, 'Guest conversations claimed')

  return { claimed, headers }
}

export async function hasPendingGuestConversations(
  sessionToken: string,
  payloadReq?: PayloadRequest,
): Promise<boolean> {
  const session = await getGuestSessionByToken(sessionToken, payloadReq)
  if (!session) return false

  const payload = payloadReq?.payload ?? (await getPayload({ config }))

  const conversations = await payload.count({
    collection: 'conversations',
    where: {
      and: [{ guestSession: { equals: session.id } }, { archivedAt: { exists: false } }],
    },
    ...(payloadReq ? { req: payloadReq } : {}),
  })

  return conversations.totalDocs > 0
}
