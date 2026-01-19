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
import { ConversationService } from '@/lib/services/conversation-service'
import { logger } from '@/utilities/logger'
import { RequestTiming } from '@/utilities/perf/request-timing'
import { PayloadRequest } from 'payload'
import { z } from 'zod'

const requestSchema = z.object({
  contextKey: z
    .string()
    .trim()
    .min(1)
    .regex(/^(courses|chapters|lessons|exercises):[^:]+$/),
})

export async function agentResetChat(
  req: PayloadRequest & { json?: () => Promise<unknown>; requestId?: string; timing?: RequestTiming },
) {
  const requestId = req.requestId ?? crypto.randomUUID()
  const reqLogger = logger.child({ requestId })
  const timing =
    req.timing ??
    new RequestTiming({ requestId, endpoint: '/api/agent/reset-chat', logger: reqLogger })
  const ownsTiming = !req.timing
  if (ownsTiming) {
    timing.markPoint('handler_entry')
  }

  // 1) Auth check
  if (!req.user) {
    const { result: response } = timing.timeSync('serialization', () =>
      Response.json({ error: 'Authentication required' }, { status: 401 }),
    )
    if (ownsTiming) {
      timing.markPoint('handler_exit')
      timing.logIfSlow()
    }
    return response
  }

  try {
    // 2) Parse and validate request body
    if (!req.json) {
      const { result: response } = timing.timeSync('serialization', () =>
        Response.json({ error: 'Invalid request' }, { status: 400 }),
      )
      if (ownsTiming) {
        timing.markPoint('handler_exit')
        timing.logIfSlow()
      }
      return response
    }

    const body = await req.json()
    const validated = requestSchema.parse(body)

    reqLogger.info(
      { userId: req.user.id, contextKey: validated.contextKey },
      'Processing reset chat request',
    )

    // 3) Initialize ConversationService
    const conversationService = new ConversationService(req.payload, {
      timing,
      logger: reqLogger,
      requestId,
      endpoint: '/api/agent/reset-chat',
    })

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

    const { result: response } = timing.timeSync('serialization', () =>
      Response.json({
        success: true,
        conversationId: newConversation.id,
        contextKey: validated.contextKey,
      }),
    )
    if (ownsTiming) {
      timing.markPoint('handler_exit')
      timing.logIfSlow()
    }
    return response
  } catch (error) {
    reqLogger.error({ err: error }, 'Reset chat endpoint error')

    if (error instanceof z.ZodError) {
      const { result: response } = timing.timeSync('serialization', () =>
        Response.json({ error: 'Invalid request', details: error.issues }, { status: 400 }),
      )
      if (ownsTiming) {
        timing.markPoint('handler_exit')
        timing.logIfSlow()
      }
      return response
    }

    const { result: response } = timing.timeSync('serialization', () =>
      Response.json({ error: 'Internal server error' }, { status: 500 }),
    )
    if (ownsTiming) {
      timing.markPoint('handler_exit')
      timing.logIfSlow()
    }
    return response
  }
}
