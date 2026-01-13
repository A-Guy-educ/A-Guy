/**
 * POST /api/agent/chat
 * Chat with AI assistant with context awareness
 *
 * @fileType endpoint
 * @domain chat
 * @pattern authenticated-endpoint, validated-endpoint
 * @ai-summary Chat endpoint with context awareness, memory retrieval, and automatic maintenance
 *
 * Access: Authenticated users only
 *
 * Features:
 * - Running summary of conversation history
 * - Long-term memory with vector search
 * - Automatic maintenance and memory extraction
 */
import {
  buildRetrievalQuery,
  composePrompt,
  getRecentWindow,
  type Message,
} from '@/lib/ai/context-policy'
import { runSummaryMaintenance } from '@/lib/ai/maintenance'
import { ChatRole } from '@/lib/ai/chat-message-role'
import { extractMemoryCandidates, persistMemoryItems } from '@/lib/ai/memory-extraction'
import { createContextLog, logContextUsage, logPromptSnapshot } from '@/lib/ai/observability'
import { chatWithExerciseHelper, getSystemPrompt } from '@/lib/ai/services/exercise-chat-service'
import { isVectorIndexAvailable } from '@/lib/ai/vector-index-check'
import { retrieveMemoryItems, type MemoryItem } from '@/lib/ai/vector-search'
import { featureFlags } from '@/lib/feature-flags'
import type { Conversation } from '@/payload-types'
import { logger } from '@/utilities/logger'
import { PayloadRequest } from 'payload'
import { z } from 'zod'

const requestSchema = z
  .object({
    message: z.string().min(1).max(1000),
    acknowledgment: z.string().min(1),
    exerciseId: z.string().min(1).optional(),
    lessonId: z.string().min(1).optional(),
  })
  .refine((data) => data.exerciseId || data.lessonId, {
    message: 'Either exerciseId or lessonId must be provided',
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

    const contextId = validated.exerciseId || validated.lessonId
    const contextType = validated.exerciseId ? 'exercise' : 'lesson'
    const contextField = validated.exerciseId ? 'exercise' : 'lesson'

    reqLogger.info({ userId: req.user.id, contextType, contextId }, 'Processing chat request')

    // 3) Find or create conversation
    const whereClause: any = { user: { equals: req.user.id } }
    whereClause[contextField] = { equals: contextId }

    const existingConv = await req.payload.find({
      collection: 'conversations',
      where: {
        and: [whereClause],
      },
      limit: 1,
      user: req.user, // Explicitly pass user for access control
      overrideAccess: false, // Enforce user's access control
    })

    let conversationId: string
    let conversation: Conversation

    if (existingConv.docs.length > 0) {
      // Use existing conversation
      conversation = existingConv.docs[0]
      conversationId = conversation.id
      reqLogger.info({ conversationId }, 'Using existing conversation')
    } else {
      // Create new conversation
      const conversationData: any = {
        user: req.user.id,
        messages: [],
        lastMessageAt: new Date().toISOString(),
        contextPolicyVersion: 'v1',
      }
      if (validated.exerciseId) {
        conversationData.exercise = validated.exerciseId
      } else if (validated.lessonId) {
        conversationData.lesson = validated.lessonId
      }

      const newConv = await req.payload.create({
        collection: 'conversations',
        data: conversationData,
        draft: false,
        user: req.user, // Explicitly pass user for access control
        overrideAccess: false, // Enforce user's access control
      })
      conversationId = newConv.id
      conversation = newConv
      reqLogger.info({ conversationId, contextType }, 'Created new conversation')
    }

    // 4) Persist user message FIRST
    const userMessage = {
      role: 'user' as const,
      content: validated.message,
      timestamp: new Date().toISOString(),
    }

    const conversationHistory = conversation.messages || []
    const allMessages = [...conversationHistory, userMessage]

    await req.payload.update({
      collection: 'conversations',
      id: conversationId,
      data: {
        messages: allMessages,
        lastMessageAt: new Date().toISOString(),
      },
      user: req.user, // Explicitly pass user for access control
      overrideAccess: false, // Enforce user's access control
    })

    // DEBUG: Log message count
    reqLogger.info(
      {
        conversationId,
        totalMessages: allMessages.length,
        messagePreview: allMessages.slice(-3).map((m: any) => ({
          role: m.role,
          content: m.content?.substring(0, 50),
        })),
      },
      '[DEBUG] Conversation messages loaded',
    )

    // 6) Get recent window from persisted messages
    const recentMessages = getRecentWindow(allMessages as Message[])

    reqLogger.info({ recentCount: recentMessages.length }, '[DEBUG] Recent window extracted')

    // 7) Retrieve memory items (if enabled)
    let memoryItems: MemoryItem[] = []
    let retrievalLatencyMs = 0
    let localCount = 0
    let globalCount = 0

    if (featureFlags.MEMORY_RETRIEVAL_ENABLED) {
      try {
        const db = (req.payload.db as any).connection.db

        // Graceful check: skip retrieval if index not available
        const indexAvailable = await isVectorIndexAvailable(db)

        if (indexAvailable) {
          const queryText = buildRetrievalQuery(recentMessages)

          // Skip retrieval if query is empty or too short
          if (queryText && queryText.trim().length >= 3) {
            reqLogger.debug({ queryText }, 'Retrieving memory items')
            const retrieval = await retrieveMemoryItems(db, req.user.id, queryText, conversationId)

            memoryItems = retrieval.items
            retrievalLatencyMs = retrieval.latencyMs
            localCount = retrieval.localCount
            globalCount = retrieval.globalCount

            reqLogger.info(
              {
                memoryCount: memoryItems.length,
                localCount,
                globalCount,
                latencyMs: retrievalLatencyMs,
                queryText,
              },
              'Retrieved memory items',
            )
          } else {
            reqLogger.debug(
              { queryText, queryLength: queryText?.trim().length },
              'Skipping memory retrieval: query text too short or empty',
            )
          }
        } else {
          reqLogger.warn('Vector search index not available, skipping memory retrieval')
        }
      } catch (error) {
        // Graceful degradation: continue without memories
        reqLogger.warn({ err: error }, 'Memory retrieval failed, continuing without memories')
      }
    }

    // 8) Compose prompt using Context Policy V1
    const systemInstructions = getSystemPrompt()
    const composedPrompt = composePrompt(systemInstructions, {
      systemMessage: systemInstructions,
      summary: conversation?.summary || undefined,
      memoryItems: memoryItems,
      recentMessages: recentMessages,
    })

    // Log prompt snapshot in development
    logPromptSnapshot(conversationId, composedPrompt)

    // 9) Call AI service with composed prompt
    const modelCallStart = Date.now()
    const result = await chatWithExerciseHelper({
      message: validated.message,
      acknowledgment: validated.acknowledgment,
      composedPrompt: composedPrompt,
    })
    const modelLatencyMs = Date.now() - modelCallStart

    if (!result.success) {
      reqLogger.error({ error: result.error, modelLatencyMs }, 'Chat request failed')
      return Response.json(
        { error: result.error || 'Failed to process chat message' },
        { status: 500 },
      )
    }

    // 10) Persist assistant response
    const assistantMessage = {
      role: 'assistant' as const,
      content: result.message || '',
      timestamp: new Date().toISOString(),
    }

    const updatedMessages = [...allMessages, assistantMessage]

    await req.payload.update({
      collection: 'conversations',
      id: conversationId,
      data: {
        messages: updatedMessages,
        lastMessageAt: new Date().toISOString(),
      },
      user: req.user, // Explicitly pass user for access control
      overrideAccess: false, // Enforce user's access control
    })

    // 11) Log context usage for observability
    logContextUsage(
      createContextLog({
        conversationId,
        userId: req.user.id,
        policyVersion: composedPrompt.metadata.policyVersion,
        summaryPresent: !!conversation?.summary,
        summaryLength: composedPrompt.metadata.summaryLength,
        memoryLocalCount: localCount,
        memoryGlobalCount: globalCount,
        memoryRetrievalLatencyMs: retrievalLatencyMs,
        messageWindowSize: composedPrompt.metadata.messageCount,
        messageTotalCount: updatedMessages.length,
        modelLatencyMs,
      }),
    )

    // 12) Background: Run summary maintenance (non-blocking)
    if (featureFlags.SUMMARY_MAINTENANCE_ENABLED) {
      runSummaryMaintenance(req.payload, conversationId).catch((err) => {
        reqLogger.error({ err, conversationId }, 'Summary maintenance failed')
      })
    }

    // 13) Background: Extract and persist memories (non-blocking)
    if (featureFlags.MEMORY_EXTRACTION_ENABLED && req.user) {
      const currentUserId = req.user.id
      reqLogger.debug({ conversationId }, 'Starting memory extraction')

      // Refresh conversation to get potential summary updates
      req.payload
        .findByID({
          collection: 'conversations',
          id: conversationId,
          user: req.user, // Explicitly pass user for access control
          overrideAccess: false, // Enforce user's access control
        })
        .then((updatedConv) => {
          const messages = updatedConv.messages || []
          reqLogger.debug({ messageCount: messages.length }, 'Loaded conversation for extraction')

          const messageList = messages.map((m) => ({
            role: m.role!,
            content: m.content!,
            timestamp: m.timestamp!,
          }))

          // Determine source role and timestamp
          // Since extraction happens after assistant response, use the assistant's message timestamp
          // But note: memories about user preferences/facts actually came from user messages
          // We use assistant role here because extraction is triggered after assistant response
          const lastMessage = messages[messages.length - 1]
          const sourceRole = ChatRole.Assistant // Extraction triggered after assistant response
          const sourceTimestamp = lastMessage?.timestamp
            ? new Date(lastMessage.timestamp)
            : new Date()

          return extractMemoryCandidates(messageList, updatedConv.summary || undefined).then(
            (candidates) => {
              reqLogger.debug({ candidateCount: candidates.length }, 'Extracted memory candidates')
              return {
                candidates,
                sourceRole,
                sourceTimestamp,
              }
            },
          )
        })
        .then(({ candidates, sourceRole, sourceTimestamp }) => {
          if (candidates.length > 0) {
            reqLogger.debug({ candidateCount: candidates.length }, 'Persisting memory items')
            return persistMemoryItems(
              req.payload,
              currentUserId,
              conversationId,
              candidates,
              sourceTimestamp,
              sourceRole,
            ).then((persisted) => {
              reqLogger.info({ persisted, conversationId }, 'Memory extraction completed')
              return persisted
            })
          } else {
            reqLogger.debug('No memory candidates to persist')
            return 0
          }
        })
        .catch((err) => {
          reqLogger.error({ err, conversationId }, 'Memory extraction failed')
        })
    } else {
      reqLogger.debug(
        {
          extractionEnabled: featureFlags.MEMORY_EXTRACTION_ENABLED,
          hasUser: !!req.user,
        },
        'Memory extraction skipped',
      )
    }

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
