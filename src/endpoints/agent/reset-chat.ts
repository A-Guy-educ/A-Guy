/**
 * POST /api/agent/reset-chat
 * Reset a conversation by archiving the current one and creating a new one
 *
 * @fileType endpoint
 * @domain chat
 * @pattern authenticated-endpoint, context-scoped
 * @ai-summary Reset endpoint for context-scoped conversations
 *
 * Access: Authenticated users only
 *
 * Request body:
 * - contextKey: The context key (e.g., "exercises:abc123")
 *
 * Response:
 * - success: boolean
 * - conversationId: ID of the new conversation
 */
import { ConversationService } from '@/server/services/conversation-service'
import { logger } from '@/utilities/logger'
import { PayloadRequest } from 'payload'
import { z } from 'zod'

const requestSchema = z.object({
  contextKey: z
    .string()
    .trim()
    .min(1)
    .regex(/^(courses|chapters|lessons|exercises):[^:]+$/),
})

export async function agentResetChat(req: PayloadRequest & { json?: () => Promise<unknown> }) {
  const requestId = crypto.randomUUID()
  const reqLogger = logger.child({ requestId })

  // 1) Auth check
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
      { userId: req.user.id, contextKey: validated.contextKey },
      'Processing reset chat request',
    )

    // 3) Initialize ConversationService
    const conversationService = new ConversationService(req.payload)

    // 4) Reset conversation (archive current, create new)
    const newConversation = await conversationService.resetConversation(
      req.user.id,
      validated.contextKey,
    )

    reqLogger.info(
      {
        userId: req.user.id,
        contextKey: validated.contextKey,
        newConversationId: newConversation.id,
      },
      'Chat reset successful',
    )

    return Response.json({
      success: true,
      conversationId: newConversation.id,
      contextKey: validated.contextKey,
    })
  } catch (error) {
    reqLogger.error({ err: error }, 'Reset chat endpoint error')

    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Invalid request', details: error.issues }, { status: 400 })
    }

    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
