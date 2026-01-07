/**
 * POST /api/agent/chat
 * Chat with AI assistant
 *
 * Access: Authenticated users only
 */
import { PayloadRequest } from 'payload'
import { z } from 'zod'
import { chatWithExerciseHelper } from '@/lib/ai'
import { logger } from '@/utilities/logger/logger'

const requestSchema = z.object({
  message: z.string().min(1).max(1000),
  acknowledgment: z.string().min(1),
})

export async function agentChat(req: PayloadRequest & { json?: () => Promise<unknown> }) {
  const requestId = crypto.randomUUID()
  const reqLogger = logger.child({ requestId })

  // 1) Auth - endpoints not authenticated by default
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

    reqLogger.info({ userId: req.user.id }, 'Processing chat request')

    // 3) Call AI service
    const result = await chatWithExerciseHelper({
      message: validated.message,
      acknowledgment: validated.acknowledgment,
    })

    if (!result.success) {
      reqLogger.error({ error: result.error }, 'Chat request failed')
      return Response.json(
        { error: result.error || 'Failed to process chat message' },
        { status: 500 },
      )
    }

    reqLogger.info('Chat request successful')
    return Response.json({
      success: true,
      message: result.message,
    })
  } catch (error) {
    reqLogger.error({ err: error }, 'Chat endpoint error')

    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Invalid request', details: error.issues }, { status: 400 })
    }

    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
