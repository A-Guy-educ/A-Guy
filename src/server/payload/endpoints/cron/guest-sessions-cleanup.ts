/**
 * POST /api/cron/guest-sessions-cleanup
 * Cleanup endpoint for expired guest sessions and orphaned conversations
 *
 * @fileType endpoint
 * @domain auth
 * @pattern cron-endpoint, authenticated-endpoint
 * @ai-summary Deletes expired guest sessions and their associated orphaned conversations
 *
 * Access: Requires CRON_SECRET bearer token
 *
 * Features:
 * - Finds all guest sessions where hardExpiresAt < now OR status = 'claimed'
 * - Deletes associated conversations for expired/claimed sessions
 * - Batch processes to avoid memory issues
 * - Returns cleanup stats for monitoring
 */
import type { Endpoint, Payload } from 'payload'
import type { Logger } from 'pino'

import { withCronMiddleware, type CronResult } from './cron-middleware'

import { getGuestChatConfig } from '@/server/config/guest-chat-config'
import type { GuestSession } from '@/payload-types'

interface ConversationDocument {
  id: string
  guestSession?: string
}

interface CleanupStats {
  expiredSessionsDeleted: number
  claimedSessionsDeleted: number
  orphanedConversationsDeleted: number
  failedSessionDeletions: number
  failedConversationDeletions: string[]
}

/**
 * Find guest sessions to clean up
 * - Hard expired: hardExpiresAt < now
 * - Revoked: status = 'revoked' (user logged in, conversations transferred)
 */
async function findGuestSessionsToCleanup(
  payload: Payload,
  now: Date,
): Promise<{ docs: GuestSession[]; totalDocs: number }> {
  const guestConfig = await getGuestChatConfig()
  const hardCapDate = new Date(now.getTime() - guestConfig.hard_cap_days * 24 * 60 * 60 * 1000)
  const hardCapDateISO = hardCapDate.toISOString()

  const result = await payload.find({
    collection: 'guest-sessions',
    where: {
      or: [
        { status: { equals: 'revoked' } },
        { hardExpiresAt: { less_than_equal: hardCapDateISO } },
      ],
    },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  return {
    docs: result.docs,
    totalDocs: result.totalDocs,
  }
}

/**
 * Find conversations associated with a guest session
 */
async function findOrphanedConversations(
  payload: Payload,
  guestSessionId: string,
): Promise<{ docs: ConversationDocument[]; totalDocs: number }> {
  const result = await payload.find({
    collection: 'conversations',
    where: {
      and: [{ guestSession: { equals: guestSessionId } }, { archivedAt: { exists: false } }],
    },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  return {
    docs: result.docs as ConversationDocument[],
    totalDocs: result.totalDocs,
  }
}

/**
 * Delete guest session record
 */
async function deleteGuestSession(payload: Payload, sessionId: string): Promise<boolean> {
  try {
    await payload.delete({
      collection: 'guest-sessions',
      id: sessionId,
      overrideAccess: true,
    })
    return true
  } catch {
    return false
  }
}

/**
 * Delete orphaned conversation
 */
async function deleteOrphanedConversation(
  payload: Payload,
  conversationId: string,
): Promise<boolean> {
  try {
    await payload.delete({
      collection: 'conversations',
      id: conversationId,
      overrideAccess: true,
    })
    return true
  } catch {
    return false
  }
}

/**
 * Process cleanup for a single guest session
 */
async function processSessionCleanup(
  payload: Payload,
  session: GuestSession,
  stats: CleanupStats,
  reqLogger: Logger,
): Promise<void> {
  try {
    // Find and delete orphaned conversations
    const conversations = await findOrphanedConversations(payload, session.id)
    for (const conv of conversations.docs) {
      const success = await deleteOrphanedConversation(payload, conv.id)
      if (success) {
        stats.orphanedConversationsDeleted++
      } else {
        stats.failedConversationDeletions.push(conv.id)
      }
    }

    // Delete the guest session
    const sessionDeleted = await deleteGuestSession(payload, session.id)
    if (sessionDeleted) {
      if (session.status === 'revoked') {
        stats.claimedSessionsDeleted++
      } else {
        stats.expiredSessionsDeleted++
      }
      reqLogger.info(
        {
          sessionId: session.id,
          status: session.status,
          conversationsDeleted: conversations.docs.length,
        },
        'Cleaned up guest session',
      )
    } else {
      stats.failedSessionDeletions++
    }
  } catch (error) {
    stats.failedSessionDeletions++
    const errorMsg = error instanceof Error ? error.message : String(error)
    reqLogger.error({ sessionId: session.id, error: errorMsg }, 'Failed to cleanup guest session')
  }
}

/**
 * Main cleanup handler
 */
async function cleanupGuestSessions(payload: Payload, reqLogger: Logger): Promise<CronResult> {
  const now = new Date()
  const stats: CleanupStats = {
    expiredSessionsDeleted: 0,
    claimedSessionsDeleted: 0,
    orphanedConversationsDeleted: 0,
    failedSessionDeletions: 0,
    failedConversationDeletions: [],
  }

  const sessionsToCleanup = await findGuestSessionsToCleanup(payload, now)
  reqLogger.info({ count: sessionsToCleanup.docs.length }, 'Found guest sessions to cleanup')

  for (const session of sessionsToCleanup.docs) {
    await processSessionCleanup(payload, session, stats, reqLogger)
  }

  return {
    success: true,
    data: {
      expiredSessionsDeleted: stats.expiredSessionsDeleted,
      claimedSessionsDeleted: stats.claimedSessionsDeleted,
      orphanedConversationsDeleted: stats.orphanedConversationsDeleted,
      failedSessionDeletions: stats.failedSessionDeletions,
      failedConversationDeletions:
        stats.failedConversationDeletions.length > 0
          ? stats.failedConversationDeletions
          : undefined,
      hasMore:
        sessionsToCleanup.totalDocs > stats.expiredSessionsDeleted + stats.claimedSessionsDeleted,
    },
  }
}

export const guestSessionsCleanupEndpoint: Endpoint = {
  path: '/cron/guest-sessions-cleanup',
  method: 'post',
  handler: withCronMiddleware(async ({ reqLogger, payload }) => {
    return cleanupGuestSessions(payload, reqLogger)
  }),
}
