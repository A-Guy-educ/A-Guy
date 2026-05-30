/**
 * Learning Chat Endpoint Handler
 * Handles SSE-based streaming for the personal learning agent
 *
 * @fileType endpoint
 * @domain chat
 * @pattern streaming, sse, learning-agent, user-scoped
 *
 * Features:
 * - SSE delivery with chunk/done/error events
 * - User-scoped conversations (no guest mode)
 * - User learning context injection
 * - Agent behavior prompt injection
 */
import { composePrompt } from '@/infra/llm/context-policy'
import { streamChatWithExerciseHelper } from '@/infra/llm/services/exercise-chat-service'
import { logger } from '@/infra/utils/logger'
import type { PayloadRequest } from 'payload'
import { z } from 'zod'

import {
  resolveAgentBehaviorPrompt,
  buildAgentBehaviorBlock,
} from '@/server/services/agent-behavior-prompt-resolver'
import { ConversationService } from '@/server/services/conversation-service'
import {
  fetchUserLearningContext,
  buildUserContextBlock,
} from '@/server/services/user-learning-context'
import {
  createSSEHeaders,
  formatChunkEvent,
  formatDoneEvent,
  formatErrorEvent,
} from '../chat/sse-helpers'

/**
 * Learning chat request schema
 */
export const learningChatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  acknowledgment: z.string().min(1).optional().default('Understood'),
  conversationId: z.string().optional(),
  gradeLevel: z.string().min(1),
})

export type LearningChatRequest = z.infer<typeof learningChatRequestSchema>

/**
 * Maximum messages to keep in conversation
 */
const MAX_MESSAGES_BEFORE_ASSISTANT = 95

/**
 * Trim messages array to stay within limit
 */
function trimMessagesForUpdate(
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: string
    hidden?: boolean
    media?: unknown[]
    chatAssets?: unknown[]
  }>,
): Array<{
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  hidden?: boolean
  media?: unknown[]
  chatAssets?: unknown[]
}> {
  return messages.slice(-MAX_MESSAGES_BEFORE_ASSISTANT)
}

/**
 * Get or create a user-scoped conversation for the learning agent
 */
async function getOrCreateUserConversation(
  conversationService: ConversationService,
  userId: string,
  existingConversationId?: string,
): Promise<{
  id: string
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: string
    hidden?: boolean
  }>
  summary?: string
}> {
  // If conversationId provided, try to find it
  if (existingConversationId) {
    try {
      const existing = await conversationService.getOrCreateActiveConversation(
        userId,
        { relationTo: 'users', value: userId },
        `users:${userId}:learning-agent`,
      )
      if (existing && existing.id === existingConversationId) {
        return existing
      }
    } catch {
      // Conversation not found or not accessible, create new one
    }
  }

  // Create/get user-scoped conversation using the service method
  const conversation = await conversationService.getOrCreateActiveConversation(
    userId,
    { relationTo: 'users', value: userId },
    `users:${userId}:learning-agent`,
  )

  return conversation
}

/**
 * Persist assistant message after streaming completes
 */
async function persistAssistantMessage(
  payload: PayloadRequest['payload'],
  conversationId: string,
  allMessages: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: string
    hidden?: boolean
    media?: unknown[]
    chatAssets?: unknown[]
  }>,
  assistantContent: string,
  reqUser: PayloadRequest['user'],
): Promise<void> {
  const assistantMessage = {
    role: 'assistant' as const,
    content: assistantContent,
    timestamp: new Date().toISOString(),
  }

  const updatedMessages = [...trimMessagesForUpdate(allMessages), assistantMessage]

  // Payload handles the internal message structure; cast required to bypass field-level typing
  await payload.update({
    collection: 'conversations',
    id: conversationId,
    data: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload field-level message typing differs from runtime shape
      messages: updatedMessages as any,
      lastMessageAt: new Date().toISOString(),
    },
    user: reqUser,
    overrideAccess: false,
  })
}

/**
 * Build a minimal context block for user-scoped learning agent
 * Since this is a global learning agent (not lesson-scoped), we provide minimal context
 */
function buildLearningAgentContextBlock(userId: string): string {
  return `## Learning Agent Context
You are a personal learning assistant for the user (ID: ${userId}).
This conversation is for general learning guidance, course recommendations, and progress tracking.
The user can ask questions about their courses, learning progress, or any learning-related topic.`
}

/**
 * Handle learning chat request
 * Returns SSE stream with chat response
 */
export async function agentLearningChat(
  req: PayloadRequest & { json?: () => Promise<unknown> },
): Promise<Response> {
  const requestId = crypto.randomUUID()
  const reqLogger = logger.child({ requestId, module: 'LearningChat' })

  try {
    // 1) Auth - learning agent requires authenticated user
    if (!req.user?.id) {
      return Response.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 },
      )
    }

    const userId = req.user.id

    // 2) Parse and validate request body
    if (!req.json) {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }

    const body = await req.json()
    const parseResult = learningChatRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return Response.json(
        { error: 'Invalid request', details: parseResult.error.issues },
        { status: 400 },
      )
    }

    const {
      message,
      acknowledgment,
      conversationId: existingConversationId,
      gradeLevel,
    } = parseResult.data

    reqLogger.info(
      { userId, gradeLevel, hasExistingConversation: !!existingConversationId },
      'Processing learning chat request',
    )

    // 3) Get or create user conversation
    const conversationService = new ConversationService(req.payload)
    const conversation = await getOrCreateUserConversation(
      conversationService,
      userId,
      existingConversationId,
    )
    const conversationId = conversation.id

    reqLogger.info({ conversationId }, 'Using conversation')

    // 4) Persist user message
    const userMessage = {
      role: 'user' as const,
      content: message,
      timestamp: new Date().toISOString(),
    }

    const conversationHistory = conversation.messages || []
    const allMessages = [
      ...trimMessagesForUpdate(
        conversationHistory as Array<{
          role: 'user' | 'assistant'
          content: string
          timestamp: string
          hidden?: boolean
          media?: unknown[]
          chatAssets?: unknown[]
        }>,
      ),
      userMessage,
    ]

    await req.payload.update({
      collection: 'conversations',
      id: conversationId,
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload field-level message typing differs from runtime shape
        messages: allMessages as any,
        lastMessageAt: new Date().toISOString(),
      },
      user: req.user,
      overrideAccess: false,
    })

    // 5) Fetch user learning context
    const userLearningContext = await fetchUserLearningContext(req.payload, userId, gradeLevel)
    const userContextBlock = buildUserContextBlock(userLearningContext)

    reqLogger.debug(
      {
        activeCourses: userLearningContext.activeCourses.length,
        completedLessons: userLearningContext.completedLessons,
        currentStreak: userLearningContext.currentStreak,
      },
      'Fetched user learning context',
    )

    // 6) Resolve agent behavior prompt
    const agentBehavior = await resolveAgentBehaviorPrompt(req.payload, userId)
    const agentBehaviorBlock = buildAgentBehaviorBlock(agentBehavior)

    reqLogger.debug(
      { profileSlug: agentBehavior.profileSlug, resolvedFrom: agentBehavior.resolvedFrom },
      'Resolved agent behavior prompt',
    )

    // 7) Compose system instructions
    // For learning agent, we use a minimal lesson prompt (empty) since it's user-scoped
    const emptyLessonPrompt = ''
    const lessonContextBlock = buildLearningAgentContextBlock(userId)

    // Since we're not using the full composeFullSystemInstructions (which expects lesson context),
    // we build the instructions directly using the prompt composer
    const { composeSystemInstructions } = await import('@/infra/llm/prompt-composer.server')

    const systemInstructions = composeSystemInstructions(
      [], // No system prompts for learning agent
      emptyLessonPrompt, // No lesson-specific prompt
      undefined, // No teacher profile
      agentBehaviorBlock, // Agent behavior block
      lessonContextBlock, // Minimal context block
      undefined, // No lesson context text
      undefined, // No course context
      undefined, // No exercises
      userContextBlock, // User learning context
      false, // No image attached
    )

    // 8) Compose prompt using Context Policy
    const composedPrompt = composePrompt(systemInstructions, {
      systemMessage: systemInstructions,
      summary: conversation.summary,
      memoryItems: [], // No memory retrieval for learning agent yet
      recentMessages: allMessages as Array<{
        role: 'user' | 'assistant'
        content: string
        timestamp: string
      }>,
    })

    // 9) Call streaming LLM
    let streamingResult
    try {
      streamingResult = await streamChatWithExerciseHelper(
        {
          message,
          acknowledgment: acknowledgment || 'Understood',
          composedPrompt,
          req: {
            headers: {
              authorization: req.headers?.get?.('authorization') || undefined,
              cookie: req.headers?.get?.('cookie') || undefined,
            },
          },
        },
        req.payload,
      )
    } catch (streamError) {
      const errorMessage = streamError instanceof Error ? streamError.message : String(streamError)
      reqLogger.error({ err: streamError }, 'Streaming chat failed')
      return Response.json(
        { error: errorMessage || 'Failed to start streaming chat' },
        { status: 500 },
      )
    }

    const { stream } = streamingResult

    // 10) Create SSE ReadableStream
    const sseStream = new ReadableStream({
      async start(controller) {
        let fullText = ''

        try {
          // Iterate over stream chunks
          for await (const chunk of stream) {
            fullText += chunk.text
            controller.enqueue(formatChunkEvent(chunk.text))
          }

          reqLogger.info({ conversationId, textLength: fullText.length }, 'Stream completed')

          // Persist assistant message
          try {
            await persistAssistantMessage(
              req.payload,
              conversationId,
              allMessages,
              fullText,
              req.user,
            )
            reqLogger.info({ conversationId }, 'Assistant message persisted')
          } catch (persistError) {
            reqLogger.warn(
              { err: persistError, conversationId },
              'Failed to persist assistant message',
            )
          }

          // Enqueue done event
          controller.enqueue(
            formatDoneEvent({ conversationId, contextKey: `users:${userId}:learning-agent` }),
          )
          controller.close()
        } catch (error) {
          reqLogger.error({ err: error, conversationId }, 'Error during streaming')

          // Persist partial text if any
          if (fullText.length > 0) {
            try {
              await persistAssistantMessage(
                req.payload,
                conversationId,
                allMessages,
                fullText,
                req.user,
              )
            } catch (persistError) {
              reqLogger.warn(
                { err: persistError, conversationId },
                'Failed to persist partial message',
              )
            }
          }

          const errorMessage = error instanceof Error ? error.message : 'Stream error'
          controller.enqueue(formatErrorEvent(errorMessage, 'STREAM_ERROR'))
          controller.error(error)
        }
      },
    })

    return new Response(sseStream, {
      headers: createSSEHeaders(),
    })
  } catch (error) {
    // Handle connection reset errors gracefully
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'ECONNRESET'
    ) {
      reqLogger.debug({ err: error }, 'Client disconnected during learning chat request')
      return Response.json({ error: 'Request cancelled' }, { status: 499 })
    }

    reqLogger.error({ err: error }, 'Learning chat endpoint error')

    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Invalid request', details: error.issues }, { status: 400 })
    }

    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
