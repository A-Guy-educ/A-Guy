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
  exerciseId: z.string().min(1),
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

    reqLogger.info(
      { userId: req.user.id, exerciseId: validated.exerciseId },
      'Processing chat request',
    )

    // 3) Find or create conversation
    const existingConv = await req.payload.find({
      collection: 'conversations',
      where: {
        and: [{ user: { equals: req.user.id } }, { exercise: { equals: validated.exerciseId } }],
      },
      limit: 1,
    })

    let conversationId: string
    let conversationHistory: Array<{ role: 'user' | 'model'; content: string }> = []

    if (existingConv.docs.length > 0) {
      // Use existing conversation
      const conversation = existingConv.docs[0]
      conversationId = conversation.id
      conversationHistory = conversation.messages || []
      reqLogger.info({ conversationId }, 'Using existing conversation')
    } else {
      // Create new conversation
      const newConv = await req.payload.create({
        collection: 'conversations',
        data: {
          user: req.user.id,
          exercise: validated.exerciseId,
          messages: [],
          lastMessageAt: new Date().toISOString(),
        },
      })
      conversationId = newConv.id
      reqLogger.info({ conversationId }, 'Created new conversation')
    }

    // 4) Add user message to conversation
    const userMessage = {
      role: 'user' as const,
      content: validated.message,
      timestamp: new Date().toISOString(),
    }

    await req.payload.update({
      collection: 'conversations',
      id: conversationId,
      data: {
        messages: [...conversationHistory, userMessage],
        lastMessageAt: new Date().toISOString(),
      },
    })

    // 5) Call AI service with conversation history
    const result = await chatWithExerciseHelper({
      message: validated.message,
      acknowledgment: validated.acknowledgment,
      conversationHistory: conversationHistory.map((msg) => ({
        role: msg.role as any,
        content: msg.content,
      })),
    })

    if (!result.success) {
      reqLogger.error({ error: result.error }, 'Chat request failed')
      return Response.json(
        { error: result.error || 'Failed to process chat message' },
        { status: 500 },
      )
    }

    // 6) Add assistant message to conversation
    const assistantMessage = {
      role: 'model' as const,
      content: result.message || '',
      timestamp: new Date().toISOString(),
    }

    await req.payload.update({
      collection: 'conversations',
      id: conversationId,
      data: {
        messages: [...conversationHistory, userMessage, assistantMessage],
        lastMessageAt: new Date().toISOString(),
      },
    })

    reqLogger.info('Chat request successful')
    return Response.json({
      success: true,
      message: result.message,
      conversationId,
    })
  } catch (error) {
    reqLogger.error({ err: error }, 'Chat endpoint error')

    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Invalid request', details: error.issues }, { status: 400 })
    }

    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
