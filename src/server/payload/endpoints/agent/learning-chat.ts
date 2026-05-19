/**
 * Learning Chat Endpoint Handler
 * Handles the learning agent chat - a user-scoped AI assistant
 * with access to user learning context and agent behavior prompts.
 *
 * @fileType endpoint
 * @domain chat
 * @pattern authenticated-endpoint, user-scoped, learning-agent
 *
 * Features:
 * - User-scoped conversations (users:{userId})
 * - User learning context injection (progress, study plan, streak)
 * - Agent behavior prompt injection
 * - Streaming SSE response
 */
import { type ComposedPrompt } from '@/infra/llm/context-policy'
import {
  streamChatWithExerciseHelper,
  type ChatMessage,
} from '@/infra/llm/services/exercise-chat-service'
import { logger } from '@/infra/utils/logger'
import type { PayloadRequest } from 'payload'
import { z } from 'zod'

import {
  fetchUserLearningContext,
  buildUserContextBlock,
} from '@/server/services/user-learning-context'
import {
  resolveAgentBehaviorPrompt,
  buildAgentBehaviorBlock,
} from '@/server/services/agent-behavior-prompt-resolver'
import { ConversationService } from '@/server/services/conversation-service'

/**
 * Learning chat request schema
 */
const learningChatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  acknowledgment: z.string().min(1),
  conversationId: z.string().optional(),
  gradeLevel: z.string().min(1),
  mediaIds: z.array(z.string()).max(5).optional(),
  chatAssetIds: z.array(z.string()).max(5).optional(),
})

type LearningChatRequest = z.infer<typeof learningChatRequestSchema>

/**
 * Handle learning agent chat
 * Authentication is required - the user must be logged in
 */
export async function agentLearningChat(
  req: PayloadRequest & { json?: () => Promise<unknown> },
): Promise<Response> {
  const requestId = crypto.randomUUID()
  const reqLogger = logger.child({ requestId })

  // Auth check - user must be authenticated
  if (!req.user) {
    return Response.json({ error: 'Authentication required', requestId }, { status: 401 })
  }

  const userId = req.user.id

  try {
    // Parse and validate request body
    if (!req.json) {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }

    const body = await req.json()
    const parseResult = learningChatRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return Response.json(
        { error: 'Invalid request body', details: parseResult.error.issues, requestId },
        { status: 400 },
      )
    }

    const validated: LearningChatRequest = parseResult.data

    // Initialize ConversationService
    const conversationService = new ConversationService(req.payload)

    // Get or create user-scoped conversation
    let conversationId = validated.conversationId
    let conversation

    if (conversationId) {
      // Get existing conversation
      try {
        conversation = await req.payload.findByID({
          collection: 'conversations',
          id: conversationId,
          depth: 0,
          req,
        })
      } catch {
        // Conversation not found - create new one
        conversation = await conversationService.getOrCreateActiveConversation(userId, {
          relationTo: 'users',
          value: userId,
        })
        conversationId = conversation.id
      }
    } else {
      conversation = await conversationService.getOrCreateActiveConversation(userId, {
        relationTo: 'users',
        value: userId,
      })
      conversationId = conversation.id
    }

    // Build user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: validated.message,
      timestamp: new Date().toISOString(),
      media: validated.mediaIds?.map((id) => ({ mediaId: id })) || [],
      chatAssets: validated.chatAssetIds?.map((id) => ({ chatAssetId: id })) || [],
    }

    // Get conversation history
    const conversationHistory = (conversation.messages as unknown as ChatMessage[]) || []
    const allMessages: ChatMessage[] = [...conversationHistory, userMessage]

    // Persist user message
    await req.payload.update({
      collection: 'conversations',
      id: conversationId,
      data: {
        messages: allMessages,
        lastMessageAt: new Date().toISOString(),
      },
      user: req.user,
      overrideAccess: false,
    })

    // Fetch user learning context
    const userLearningContext = await fetchUserLearningContext(
      req.payload,
      userId,
      validated.gradeLevel,
    )
    const userContextBlock = buildUserContextBlock(userLearningContext)

    reqLogger.info(
      { userId, conversationId, hasUserContext: userLearningContext.completedLessons > 0 },
      'Fetched user learning context',
    )

    // Resolve agent behavior prompt
    const agentBehavior = await resolveAgentBehaviorPrompt(req.payload, userId)
    const agentBehaviorBlock = buildAgentBehaviorBlock(agentBehavior)

    reqLogger.info(
      {
        userId,
        agentBehaviorSlug: agentBehavior.profileSlug,
        resolvedFrom: agentBehavior.resolvedFrom,
      },
      'Resolved agent behavior prompt',
    )

    // Build context key
    const contextKey = `users:${userId}`

    // Build system instructions for learning chat
    const systemInstructions = buildLearningChatSystemInstructions(
      agentBehaviorBlock,
      userContextBlock,
    )

    // Build ComposedPrompt with messages and metadata
    const composedPrompt: ComposedPrompt = {
      messages: [
        {
          role: 'system',
          content: systemInstructions,
        },
      ],
      metadata: {
        policyVersion: 'learning-agent-v1',
        summaryLength: 0,
        memoryCount: 0,
        messageCount: allMessages.length,
      },
    }

    // Build conversation history for the chat service
    const chatHistory: ChatMessage[] = conversationHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
    }))

    // Stream response using SSE
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullText = ''

          const streamResult = await streamChatWithExerciseHelper(
            {
              message: validated.message,
              acknowledgment: validated.acknowledgment || '',
              composedPrompt,
              conversationHistory: chatHistory,
              req: {
                headers: {
                  authorization: req.headers.get?.('authorization') || undefined,
                  cookie: req.headers.get?.('cookie') || undefined,
                },
              },
            },
            req.payload,
          )

          for await (const chunk of streamResult.stream) {
            fullText += chunk.text

            // Send SSE chunk event
            const chunkData = `data: ${JSON.stringify({ type: 'chunk', text: chunk.text })}\n\n`
            controller.enqueue(encoder.encode(chunkData))
          }

          // Send SSE done event
          const doneData = `data: ${JSON.stringify({
            type: 'done',
            conversationId,
            contextKey,
          })}\n\n`
          controller.enqueue(encoder.encode(doneData))

          // Persist assistant response
          if (fullText) {
            const assistantMessage: ChatMessage = {
              role: 'assistant',
              content: fullText,
              timestamp: new Date().toISOString(),
            }
            const updatedMessages: ChatMessage[] = [...allMessages, assistantMessage]

            await req.payload.update({
              collection: 'conversations',
              id: conversationId,
              data: {
                messages: updatedMessages,
                lastMessageAt: new Date().toISOString(),
              },
              user: req.user,
              overrideAccess: false,
            })
          }

          controller.close()
        } catch (error) {
          reqLogger.error({ err: error }, 'Stream error in learning chat')
          const errorData = `data: ${JSON.stringify({ type: 'error', error: 'Stream failed' })}\n\n`
          controller.enqueue(encoder.encode(errorData))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    reqLogger.error({ err: error, userId }, 'Learning chat error')
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        requestId,
      },
      { status: 500 },
    )
  }
}

/**
 * Build system instructions for learning chat
 * Simple composition without lesson/course context
 */
function buildLearningChatSystemInstructions(
  agentBehaviorBlock: string,
  userContextBlock: string,
): string {
  const lines: string[] = []

  lines.push('## Learning Agent System Prompt')
  lines.push('')
  lines.push(
    'You are a personal AI learning assistant. You help students with their learning journey by providing:',
  )
  lines.push('- Personalized guidance and recommendations')
  lines.push('- Help with course content and questions')
  lines.push('- Motivation and encouragement')
  lines.push('- Study plan suggestions')
  lines.push('- Progress tracking and reminders')
  lines.push('')
  lines.push(
    "Be friendly, supportive, and encouraging. Celebrate the student's progress and help them stay motivated.",
  )
  lines.push('')
  lines.push(agentBehaviorBlock)
  lines.push('')
  lines.push(userContextBlock)
  lines.push('')
  lines.push('## Response Guidelines')
  lines.push('- Always be encouraging and positive')
  lines.push('- Provide specific, actionable recommendations')
  lines.push("- Reference the student's progress when relevant")
  lines.push('- Suggest next steps for their learning journey')
  lines.push('- Use examples and explanations appropriate to their level')

  return lines.join('\n')
}
