/**
 * GET /api/agent/conversation
 * Fetch user's conversation history for a context
 *
 * @fileType endpoint
 * @domain chat
 * @pattern authenticated-endpoint, validated-endpoint, context-scoped
 * @ai-summary Get conversation endpoint with explicit user isolation
 *
 * Security: Explicitly filters by authenticated user ID to guarantee isolation
 * This endpoint ensures users can only access their own conversations, even if
 * multiple users have conversations with the same contextKey.
 *
 * Access: Authenticated users only
 */
import { ChatRole } from '@/infra/llm/chat-message-role'
import { logger } from '@/utilities/logger'
import { PayloadRequest } from 'payload'
import { z } from 'zod'

const requestSchema = z.object({
  contextKey: z.string().min(1),
})

export async function getConversation(req: PayloadRequest & { json?: () => Promise<unknown> }) {
  const requestId = crypto.randomUUID()
  const reqLogger = logger.child({ requestId })

  // 1) Auth check - endpoints not authenticated by default
  if (!req.user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    // 2) Parse and validate request body
    if (!req.json) {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }

    const body = await req.json()
    const validated = requestSchema.parse(body)

    reqLogger.info(
      {
        userId: req.user.id,
        contextKey: validated.contextKey,
      },
      'Fetching conversation',
    )

    // 3) Query with EXPLICIT user filter - guarantees user isolation
    // This ensures that even if multiple users have conversations with the same contextKey,
    // only the authenticated user's conversation is returned
    // Retry logic to handle potential read-after-write consistency issues
    let conversation = null
    let attempts = 0
    const maxAttempts = 3
    const retryDelayMs = 100

    while (attempts < maxAttempts) {
      const result = await req.payload.find({
        collection: 'conversations',
        where: {
          and: [
            { user: { equals: req.user.id } }, // Explicit user filter - CRITICAL for security
            { contextKey: { equals: validated.contextKey } },
            { archivedAt: { exists: false } }, // Only active conversations
          ],
        },
        limit: 1,
        sort: '-lastMessageAt', // Most recent first
        depth: 0, // No relationship population needed
        user: req.user,
        overrideAccess: false, // Enforce access control
      })

      if (result.docs.length > 0) {
        conversation = result.docs[0]
        reqLogger.debug(
          {
            userId: req.user.id,
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
          userId: req.user.id,
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
      })
    }

    // Verify conversation ownership (defense in depth)
    const conversationUserId =
      typeof conversation.user === 'object' ? conversation.user.id : conversation.user

    if (conversationUserId !== req.user.id) {
      reqLogger.error(
        {
          userId: req.user.id,
          conversationId: conversation.id,
          conversationUserId,
          contextKey: validated.contextKey,
        },
        'SECURITY: Conversation user mismatch - this should never happen',
      )
      return Response.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Format messages for client
    const rawMessages = conversation.messages || []
    reqLogger.info(
      {
        userId: req.user.id,
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
        // Filter out invalid messages - ensure role and content are present and valid
        if (!msg || !msg.role || !msg.content) return false
        // Ensure content is a non-empty string
        if (typeof msg.content !== 'string' || msg.content.trim().length === 0) return false
        // Ensure role is valid
        if (msg.role !== 'user' && msg.role !== 'assistant') return false
        return true
      })
      .map((msg) => ({
        role: msg.role === 'user' ? ChatRole.User : ChatRole.Assistant,
        content: String(msg.content).trim(),
      }))

    reqLogger.info(
      {
        userId: req.user.id,
        conversationId: conversation.id,
        contextKey: validated.contextKey,
        messageCount: messages.length,
        messagesPreview: messages
          .slice(0, 2)
          .map((m) => ({ role: m.role, content: m.content.substring(0, 30) })),
      },
      'Conversation loaded successfully',
    )

    return Response.json({
      success: true,
      exists: true,
      conversationId: conversation.id,
      messages,
      contextKey: conversation.contextKey || validated.contextKey,
    })
  } catch (error) {
    reqLogger.error({ err: error }, 'Get conversation endpoint error')

    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Invalid request', details: error.issues }, { status: 400 })
    }

    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
