/**
 * GET /api/agent/conversation
 * Fetch user's or guest's conversation history for a context
 *
 * @fileType endpoint
 * @domain chat
 * @pattern authenticated-endpoint, validated-endpoint, context-scoped, guest-session
 * @ai-summary Get conversation endpoint with explicit user/guest isolation
 *
 * Security: Explicitly filters by authenticated user ID OR guest session ID
 * This endpoint ensures users/guests can only access their own conversations.
 *
 * Access: Authenticated users OR guest sessions
 */
import { ChatRole } from '@/infra/llm/chat-message-role'
import { logger } from '@/infra/utils/logger'
import { getGuestSessionByToken, getGuestSessionCookie } from '@/server/services/guest-session'
import type { PayloadRequest } from 'payload'
import { z } from 'zod'

const requestSchema = z.object({
  contextKey: z.string().min(1),
})

export async function getConversation(req: PayloadRequest & { json?: () => Promise<unknown> }) {
  const requestId = crypto.randomUUID()
  const reqLogger = logger.child({ requestId })

  // 1) Auth check - check for authenticated user OR guest session
  const { user } = await req.payload.auth({ headers: req.headers })

  let guestSessionId: string | null = null
  let isGuestMode = false

  if (!user) {
    // Check for guest session
    const guestToken = getGuestSessionCookie(req.headers as unknown as Headers)
    if (guestToken) {
      const guestSession = await getGuestSessionByToken(guestToken)
      if (guestSession) {
        guestSessionId = guestSession.id
        isGuestMode = true
      }
    }
  }

  // Require either authenticated user or guest session
  if (!user && !guestSessionId) {
    return Response.json(
      { error: 'Authentication or guest session required', isGuestMode: false },
      { status: 401 },
    )
  }

  const ownerId = user?.id ?? guestSessionId!

  try {
    // 2) Parse and validate request body
    if (!req.json) {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }

    const body = await req.json()
    const validated = requestSchema.parse(body)

    reqLogger.info(
      {
        userId: user?.id,
        guestSessionId,
        contextKey: validated.contextKey,
        isGuestMode,
      },
      'Fetching conversation',
    )

    // 3) Query with explicit ownership filter (user OR guestSession)
    let conversation = null
    let attempts = 0
    const maxAttempts = 3
    const retryDelayMs = 100

    while (attempts < maxAttempts) {
      const whereClause = guestSessionId
        ? {
            and: [
              { guestSession: { equals: guestSessionId } },
              { contextKey: { equals: validated.contextKey } },
              { archivedAt: { exists: false } },
            ],
          }
        : {
            and: [
              { user: { equals: ownerId } },
              { contextKey: { equals: validated.contextKey } },
              { archivedAt: { exists: false } },
            ],
          }

      const result = await req.payload.find({
        collection: 'conversations',
        where: whereClause as any,
        limit: 1,
        sort: '-lastMessageAt',
        depth: 2,
        user: user ?? undefined,
        overrideAccess: false,
      })

      if (result.docs.length > 0) {
        conversation = result.docs[0]
        reqLogger.debug(
          {
            userId: ownerId,
            contextKey: validated.contextKey,
            conversationId: conversation.id,
            attempt: attempts + 1,
          },
          'Found conversation',
        )
        break
      }

      if (attempts < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
      }
      attempts++
    }

    if (!conversation) {
      reqLogger.debug(
        {
          userId: ownerId,
          guestSessionId,
          contextKey: validated.contextKey,
          attempts,
        },
        'No conversation found after retries',
      )

      return Response.json({
        success: true,
        exists: false,
        messages: [],
        contextKey: validated.contextKey,
        isGuestMode,
      })
    }

    // Format messages for client
    const rawMessages = conversation.messages || []
    reqLogger.info(
      {
        userId: ownerId,
        conversationId: conversation.id,
        contextKey: validated.contextKey,
        rawMessagesCount: rawMessages.length,
        rawMessagesPreview: rawMessages.slice(0, 2).map((m) => ({
          role: m.role,
          content:
            typeof m.content === 'string'
              ? m.content.substring(0, 30)
              : String(m.content).substring(0, 30),
        })),
      },
      '[DEBUG] Raw messages from database',
    )

    const messages = rawMessages
      .filter((msg) => {
        if (!msg || !msg.role || !msg.content) return false
        if (typeof msg.content !== 'string' || msg.content.trim().length === 0) return false
        if (msg.role !== 'user' && msg.role !== 'assistant') return false
        return true
      })
      .map((msg) => {
        if (msg.media && msg.media.length > 0) {
          reqLogger.info(
            {
              msgRole: msg.role,
              rawMediaStructure: msg.media[0],
              hasMediaId: 'mediaId' in (msg.media[0] || {}),
            },
            '[DEBUG] Raw media structure from DB',
          )
        }

        return {
          role: msg.role === 'user' ? ChatRole.User : ChatRole.Assistant,
          content: String(msg.content).trim(),
          media: msg.media?.map((m) => {
            if (typeof m === 'object' && m !== null && 'mediaId' in m) {
              const mediaId = typeof m.mediaId === 'object' ? m.mediaId.id : m.mediaId
              const filename = typeof m.mediaId === 'object' ? m.mediaId.filename : undefined
              reqLogger.info({ mediaId, filename }, '[DEBUG] Mapped media item')
              return {
                mediaId: String(mediaId),
                filename,
              }
            }
            reqLogger.warn({ rawM: m }, '[DEBUG] Unexpected media structure')
            return { mediaId: String(m), filename: undefined }
          }),
        }
      })

    reqLogger.info(
      {
        userId: ownerId,
        conversationId: conversation.id,
        contextKey: validated.contextKey,
        messageCount: messages.length,
        messagesWithMedia: messages.filter((m) => m.media && m.media.length > 0).length,
        firstMessageMedia: messages[0]?.media,
        messagesPreview: messages
          .slice(0, 2)
          .map((m) => ({ role: m.role, content: m.content.substring(0, 30), media: m.media })),
      },
      '[DEBUG] Conversation loaded successfully',
    )

    return Response.json({
      success: true,
      exists: true,
      conversationId: conversation.id,
      messages,
      contextKey: conversation.contextKey || validated.contextKey,
      isGuestMode,
    })
  } catch (error) {
    reqLogger.error({ err: error }, 'Get conversation endpoint error')

    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Invalid request', details: error.issues }, { status: 400 })
    }

    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
