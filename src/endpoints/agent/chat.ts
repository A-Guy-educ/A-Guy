/**
 * POST /api/agent/chat
 * Chat with AI assistant with context awareness
 *
 * @fileType endpoint
 * @domain chat
 * @pattern authenticated-endpoint, validated-endpoint, context-scoped
 * @ai-summary Chat endpoint with context scoping, memory retrieval, and automatic maintenance
 *
 * Access: Authenticated users only
 *
 * Features:
 * - Context-scoped conversations (Course/Chapter/Lesson/Exercise)
 * - Running summary of conversation history
 * - Long-term memory with hierarchical vector search
 * - Automatic maintenance and memory extraction
 */
import { AccountRole } from '@/collections/Users/roles'
import { ChatRole } from '@/lib/ai/chat-message-role'
import {
  buildRetrievalQuery,
  composePrompt,
  getRecentWindow,
  type Message,
} from '@/lib/ai/context-policy'
import { runSummaryMaintenance } from '@/lib/ai/maintenance'
import { extractMemoryCandidates, persistMemoryItems } from '@/lib/ai/memory-extraction'
import { createContextLog, logContextUsage, logPromptSnapshot } from '@/lib/ai/observability'
import { composeSystemInstructions } from '@/lib/ai/prompt-composer.server'
import { resolveAgentSystemPrompt } from '@/lib/ai/prompt-resolver.server'
import { chatWithExerciseHelper } from '@/lib/ai/services/exercise-chat-service'
import { fetchPublishedSystemPrompts } from '@/lib/ai/system-prompts.server'
import { isVectorIndexAvailable } from '@/lib/ai/vector-index-check'
import { retrieveMemoryItems, type MemoryItem } from '@/lib/ai/vector-search'
import { ConversationService, deriveContextLevel } from '@/lib/services/conversation-service'
import type { Prompt } from '@/payload-types'
import { logger } from '@/utilities/logger'
import {
  getFilterShapeKeys,
  RequestTiming,
  timeDbOperation,
} from '@/utilities/perf/request-timing'
import { PayloadRequest } from 'payload'
import { z } from 'zod'

const requestSchema = z.object({
  message: z.string().min(1).max(1000),
  acknowledgment: z.string().min(1),
  // Context parameters (prefer IDs over slugs)
  exerciseId: z.string().optional(),
  lessonId: z.string().optional(),
  chapterId: z.string().optional(),
  courseId: z.string().optional(),
})

export async function agentChat(
  req: PayloadRequest & { json?: () => Promise<unknown>; requestId?: string; timing?: RequestTiming },
) {
  const requestId = req.requestId ?? crypto.randomUUID()
  const reqLogger = logger.child({ requestId })
  const timing =
    req.timing ?? new RequestTiming({ requestId, endpoint: '/api/agent/chat', logger: reqLogger })
  const ownsTiming = !req.timing
  if (ownsTiming) {
    timing.markPoint('handler_entry')
  }

  const user = req.user

  // 1) Auth - endpoints not authenticated by default
  if (!user) {
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

    const contextCandidate = validated.exerciseId
      ? { relationTo: 'exercises' as const, value: validated.exerciseId }
      : validated.lessonId
        ? { relationTo: 'lessons' as const, value: validated.lessonId }
        : validated.chapterId
          ? { relationTo: 'chapters' as const, value: validated.chapterId }
          : validated.courseId
            ? { relationTo: 'courses' as const, value: validated.courseId }
            : null

    if (!contextCandidate) {
      const { result: response } = timing.timeSync('serialization', () =>
        Response.json(
          { error: 'Missing context ID (requires exerciseId, lessonId, chapterId, or courseId)' },
          { status: 400 },
        ),
      )
      if (ownsTiming) {
        timing.markPoint('handler_exit')
        timing.logIfSlow()
      }
      return response
    }

    try {
      const contextWhere = { id: { equals: contextCandidate.value } }
      const contextResult = await timeDbOperation(
        timing,
        {
          stage: 'db_query:context_lookup',
          collection: contextCandidate.relationTo,
          filterKeys: getFilterShapeKeys(contextWhere),
          limit: 1,
          sort: undefined,
          logger: reqLogger,
          requestId,
          endpoint: '/api/agent/chat',
        },
        () =>
          req.payload.find({
            collection: contextCandidate.relationTo,
            where: contextWhere,
            limit: 1,
            depth: 0,
            user: user,
            overrideAccess: false,
          }),
      )

      if (contextResult.docs.length === 0) {
        reqLogger.warn(
          { userId: user.id, context: contextCandidate },
          'Context not found for chat request',
        )
        const { result: response } = timing.timeSync('serialization', () =>
          Response.json({ error: 'Context not found' }, { status: 404 }),
        )
        if (ownsTiming) {
          timing.markPoint('handler_exit')
          timing.logIfSlow()
        }
        return response
      }
    } catch (error) {
      reqLogger.warn(
        { err: error, userId: user.id, context: contextCandidate },
        'Invalid context ID in chat request',
      )
      const { result: response } = timing.timeSync('serialization', () =>
        Response.json({ error: 'Invalid context ID' }, { status: 400 }),
      )
      if (ownsTiming) {
        timing.markPoint('handler_exit')
        timing.logIfSlow()
      }
      return response
    }

    reqLogger.info(
      {
        userId: user.id,
        exerciseId: validated.exerciseId,
        lessonId: validated.lessonId,
        chapterId: validated.chapterId,
        courseId: validated.courseId,
      },
      'Processing chat request',
    )

    // 3) Initialize ConversationService and resolve context
    const conversationService = new ConversationService(req.payload, {
      timing,
      logger: reqLogger,
      requestId,
      endpoint: '/api/agent/chat',
    })

    const context = await conversationService.resolveContext({
      exerciseId: validated.exerciseId,
      lessonId: validated.lessonId,
      chapterId: validated.chapterId,
      courseId: validated.courseId,
    })

    reqLogger.info(
      { userId: user.id, contextKey: context.contextKey, contextRelation: context.relationTo },
      'Resolved context',
    )

    // 4) Validate context access
    const hasAccess = await conversationService.validateContextAccess(
      user.id,
      user.role as AccountRole,
      { relationTo: context.relationTo, value: context.value },
    )

    if (!hasAccess) {
      const { result: response } = timing.timeSync('serialization', () =>
        Response.json({ error: 'Unauthorized to access this context' }, { status: 403 }),
      )
      if (ownsTiming) {
        timing.markPoint('handler_exit')
        timing.logIfSlow()
      }
      return response
    }

    // 5) Get or create conversation
    const conversation = await conversationService.getOrCreateActiveConversation(user.id, {
      relationTo: context.relationTo,
      value: context.value,
    })

    const conversationId = conversation.id

    reqLogger.info({ conversationId, contextKey: context.contextKey }, 'Using conversation')

    // 6) Persist user message FIRST
    const userMessage = {
      role: 'user' as const,
      content: validated.message,
      timestamp: new Date().toISOString(),
    }

    const conversationHistory = conversation.messages || []
    const allMessages = [...conversationHistory, userMessage]

    await timeDbOperation(
      timing,
      {
        stage: 'db_query:conversation_update_user_message',
        collection: 'conversations',
        filterKeys: ['id'],
        limit: undefined,
        sort: undefined,
        logger: reqLogger,
        requestId,
        endpoint: '/api/agent/chat',
      },
      () =>
        req.payload.update({
          collection: 'conversations',
          id: conversationId,
          data: {
            messages: allMessages,
            lastMessageAt: new Date().toISOString(),
          },
          user: user,
          overrideAccess: false,
        }),
    )

    // DEBUG: Log message count
    reqLogger.info(
      {
        conversationId,
        totalMessages: allMessages.length,
        messagePreview: allMessages.slice(-3).map((m) => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content.substring(0, 50) : '',
        })),
      },
      '[DEBUG] Conversation messages loaded',
    )

    // 7) Get recent window from persisted messages
    const recentMessages = getRecentWindow(allMessages as Message[])

    reqLogger.info({ recentCount: recentMessages.length }, '[DEBUG] Recent window extracted')

    // 8) Retrieve memory items (if enabled)
    let memoryItems: MemoryItem[] = []
    let retrievalLatencyMs = 0
    let localCount = 0
    let contextCount = 0
    let globalCount = 0
    let hierarchyKeys: string[] = []

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = (req.payload.db as any).connection.db

      // Graceful check: skip retrieval if index not available
      const { result: indexAvailable } = await timing.time('external_call:vector_index_check', () =>
        isVectorIndexAvailable(db),
      )

      if (indexAvailable) {
        const queryText = buildRetrievalQuery(recentMessages)

        // Skip retrieval if query is empty or too short
        if (queryText && queryText.trim().length >= 3) {
          reqLogger.debug({ queryText }, 'Retrieving memory items')

          const { result: retrieval } = await timing.time('external_call:vector_search', () =>
            retrieveMemoryItems(
              db,
              user.id,
              queryText,
              conversationId,
              context.contextKey,
              req.payload,
            ),
          )

          memoryItems = retrieval.items
          retrievalLatencyMs = retrieval.latencyMs
          localCount = retrieval.localCount
          contextCount = retrieval.contextCount
          globalCount = retrieval.globalCount
          hierarchyKeys = retrieval.hierarchyKeys

          reqLogger.info(
            {
              memoryCount: memoryItems.length,
              localCount,
              contextCount,
              globalCount,
              latencyMs: retrievalLatencyMs,
              queryText,
              hierarchyKeys,
            },
            'Retrieved memory items with hierarchy',
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

    // 9) Fetch lesson context and prompt using secure fetch pattern
    //
    // We use a two-fetch pattern for security:
    // - Lesson fetched with normal access checks (overrideAccess: false)
    // - Prompt fetched separately with overrideAccess: true (admin-only collection)
    // This preserves Lesson access control while allowing server access to Prompts.

    let lessonContextText: string | undefined
    let lessonPrompt: Prompt | null = null

    if (context.relationTo === 'lessons') {
      // Direct lesson context - fetch with access checks
      const lesson = await timeDbOperation(
        timing,
        {
          stage: 'db_query:lesson_by_id',
          collection: 'lessons',
          filterKeys: ['id'],
          limit: undefined,
          sort: undefined,
          logger: reqLogger,
          requestId,
          endpoint: '/api/agent/chat',
        },
        () =>
          req.payload.findByID({
            collection: 'lessons',
            id: context.value,
            depth: 0,
            user: user, // Pass user for access control
            // DO NOT use overrideAccess here - preserve lesson access control
            overrideAccess: false,
          }),
      )
      lessonContextText = (lesson as { lessonContextText?: string }).lessonContextText ?? undefined

      // Fetch prompt separately if lesson has one (admin-only, requires override)
      if ((lesson as { prompt?: unknown }).prompt) {
        const promptId =
          typeof (lesson as { prompt: unknown }).prompt === 'string'
            ? (lesson as { prompt: string }).prompt
            : (lesson as { prompt: { id: string } }).prompt.id

        try {
          lessonPrompt = (await timeDbOperation(
            timing,
            {
              stage: 'db_query:prompt_by_id',
              collection: 'prompts',
              filterKeys: ['id'],
              limit: undefined,
              sort: undefined,
              logger: reqLogger,
              requestId,
              endpoint: '/api/agent/chat',
            },
            () =>
              req.payload.findByID({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                collection: 'prompts' as any,
                id: promptId,
                overrideAccess: true, // Prompts are admin-only
              }),
          )) as Prompt | null
        } catch (error) {
          reqLogger.warn(
            { err: error, promptId, lessonId: context.value },
            'Failed to fetch lesson prompt',
          )
          // Continue with null - will fall back to default
        }
      }
    } else if (context.relationTo === 'exercises') {
      // Exercise context - inherit parent lesson's prompt
      const exercise = await timeDbOperation(
        timing,
        {
          stage: 'db_query:exercise_by_id',
          collection: 'exercises',
          filterKeys: ['id'],
          limit: undefined,
          sort: undefined,
          logger: reqLogger,
          requestId,
          endpoint: '/api/agent/chat',
        },
        () =>
          req.payload.findByID({
            collection: 'exercises',
            id: context.value,
            depth: 0,
            user: user, // Pass user for access control
            overrideAccess: false,
          }),
      )

      if ((exercise as { lesson?: unknown }).lesson) {
        const lessonId =
          typeof (exercise as { lesson: unknown }).lesson === 'string'
            ? (exercise as { lesson: string }).lesson
            : (exercise as { lesson: { id: string } }).lesson.id

        // Fetch lesson with access checks
        const lesson = await timeDbOperation(
          timing,
          {
            stage: 'db_query:lesson_by_id_for_exercise',
            collection: 'lessons',
            filterKeys: ['id'],
            limit: undefined,
            sort: undefined,
            logger: reqLogger,
            requestId,
            endpoint: '/api/agent/chat',
          },
          () =>
            req.payload.findByID({
              collection: 'lessons',
              id: lessonId,
              depth: 0,
              user: user, // Pass user for access control
              // DO NOT use overrideAccess here
              overrideAccess: false,
            }),
        )
        lessonContextText =
          (lesson as { lessonContextText?: string }).lessonContextText ?? undefined

        // Fetch prompt separately if lesson has one
        if ((lesson as { prompt?: unknown }).prompt) {
          const promptId =
            typeof (lesson as { prompt: unknown }).prompt === 'string'
              ? (lesson as { prompt: string }).prompt
              : (lesson as { prompt: { id: string } }).prompt.id

          try {
            lessonPrompt = (await timeDbOperation(
              timing,
              {
                stage: 'db_query:prompt_by_id_for_exercise',
                collection: 'prompts',
                filterKeys: ['id'],
                limit: undefined,
                sort: undefined,
                logger: reqLogger,
                requestId,
                endpoint: '/api/agent/chat',
              },
              () =>
                req.payload.findByID({
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  collection: 'prompts' as any,
                  id: promptId,
                  overrideAccess: true,
                }),
            )) as Prompt | null
          } catch (error) {
            reqLogger.warn({ err: error, promptId, lessonId }, 'Failed to fetch lesson prompt')
          }
        }
      }
    }

    // 9.5) Fetch published system prompts (always included)
    const systemPromptsResult = await fetchPublishedSystemPrompts(req.payload, {
      timing,
      logger: reqLogger,
      requestId,
      endpoint: '/api/agent/chat',
    })

    if (systemPromptsResult.count > 0) {
      reqLogger.info(
        {
          systemPromptCount: systemPromptsResult.count,
          systemPromptIds: systemPromptsResult.promptIds,
          systemPromptTitles: systemPromptsResult.promptTitles,
        },
        'Including system prompts',
      )
    }

    // 10) Resolve system prompt using pre-loaded prompt object
    const promptResolution = await resolveAgentSystemPrompt(req.payload, lessonPrompt, {
      timing,
      logger: reqLogger,
      requestId,
      endpoint: '/api/agent/chat',
    })

    reqLogger.info(
      {
        promptId: promptResolution.promptId,
        promptTitle: promptResolution.promptTitle,
        resolvedFrom: promptResolution.resolvedFrom,
        ...(promptResolution.fallbackReason && { fallbackReason: promptResolution.fallbackReason }),
      },
      'Resolved system prompt',
    )

    // Compose final system instructions: system prompts + lesson prompt + lesson context
    let systemInstructions: string
    try {
      systemInstructions = composeSystemInstructions(
        systemPromptsResult.templates,
        promptResolution.template,
        lessonContextText,
      )
    } catch (error) {
      if (error instanceof Error && error.message.includes('exceeds maximum')) {
      const { result: response } = timing.timeSync('serialization', () =>
        Response.json(
          { error: 'Lesson context exceeds maximum allowed size' },
          { status: 400 },
        ),
      )
      if (ownsTiming) {
        timing.markPoint('handler_exit')
        timing.logIfSlow()
      }
      return response
    }
    throw error
  }

    // 11) Compose prompt using Context Policy V1
    const composedPrompt = composePrompt(systemInstructions, {
      systemMessage: systemInstructions,
      summary: conversation?.summary || undefined,
      memoryItems: memoryItems,
      recentMessages: recentMessages,
    })

    // Log prompt snapshot in development
    logPromptSnapshot(conversationId, composedPrompt)

    // 12) Call AI service with composed prompt
    const { result, durationMs: modelLatencyMs } = await timing.time('external_call:ai_model', () =>
      chatWithExerciseHelper({
        message: validated.message,
        acknowledgment: validated.acknowledgment,
        composedPrompt: composedPrompt,
      }),
    )

    if (!result.success) {
      reqLogger.error({ error: result.error, modelLatencyMs }, 'Chat request failed')
      const { result: response } = timing.timeSync('serialization', () =>
        Response.json(
          { error: result.error || 'Failed to process chat message' },
          { status: 500 },
        ),
      )
      if (ownsTiming) {
        timing.markPoint('handler_exit')
        timing.logIfSlow()
      }
      return response
    }

    // 13) Persist assistant response
    const assistantMessage = {
      role: 'assistant' as const,
      content: result.message || '',
      timestamp: new Date().toISOString(),
    }

    const updatedMessages = [...allMessages, assistantMessage]

    await timeDbOperation(
      timing,
      {
        stage: 'db_query:conversation_update_assistant_message',
        collection: 'conversations',
        filterKeys: ['id'],
        limit: undefined,
        sort: undefined,
        logger: reqLogger,
        requestId,
        endpoint: '/api/agent/chat',
      },
      () =>
        req.payload.update({
          collection: 'conversations',
          id: conversationId,
          data: {
            messages: updatedMessages,
            lastMessageAt: new Date().toISOString(),
          },
          user: user,
          overrideAccess: false,
        }),
    )

    // 14) Log context usage for observability
    logContextUsage(
      createContextLog({
        conversationId,
        userId: user.id,
        policyVersion: composedPrompt.metadata.policyVersion,
        summaryPresent: !!conversation?.summary,
        summaryLength: composedPrompt.metadata.summaryLength,
        memoryLocalCount: localCount,
        memoryContextCount: contextCount,
        memoryGlobalCount: globalCount,
        memoryRetrievalLatencyMs: retrievalLatencyMs,
        messageWindowSize: composedPrompt.metadata.messageCount,
        messageTotalCount: updatedMessages.length,
        modelLatencyMs,
        hierarchyKeys,
      }),
    )

    // 15) Background: Run summary maintenance (non-blocking)
    runSummaryMaintenance(req.payload, conversationId).catch((err) => {
      reqLogger.error({ err, conversationId }, 'Summary maintenance failed')
    })

    // 16) Background: Extract and persist memories (non-blocking)
    const currentUserId = user.id
    reqLogger.debug({ conversationId }, 'Starting memory extraction')

    // Refresh conversation to get potential summary updates
    req.payload
      .findByID({
        collection: 'conversations',
        id: conversationId,
        user: user,
        overrideAccess: false,
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
        const lastMessage = messages[messages.length - 1]
        const sourceRole = ChatRole.Assistant
        const sourceTimestamp = lastMessage?.timestamp
          ? new Date(lastMessage.timestamp)
          : new Date()

        // Derive context info for memory extraction
        const contextLevel = deriveContextLevel(context.relationTo)

        return extractMemoryCandidates(messageList, updatedConv.summary || undefined).then(
          (candidates) => {
            reqLogger.debug({ candidateCount: candidates.length }, 'Extracted memory candidates')
            return {
              candidates,
              sourceRole,
              sourceTimestamp,
              contextLevel,
            }
          },
        )
      })
      .then(({ candidates, sourceRole, sourceTimestamp, contextLevel }) => {
        if (candidates.length > 0) {
          reqLogger.debug({ candidateCount: candidates.length }, 'Persisting memory items')
          return persistMemoryItems(
            req.payload,
            currentUserId,
            conversationId,
            candidates,
            sourceTimestamp,
            sourceRole,
            context.contextKey,
            contextLevel,
          ).then((persisted) => {
            reqLogger.info({ persisted, conversationId }, 'Memory extraction completed')
            return persisted
          })
        }

        reqLogger.debug('No memory candidates to persist')
        return 0
      })
      .catch((err) => {
        reqLogger.error({ err, conversationId }, 'Memory extraction failed')
      })

    reqLogger.info('Chat request successful')
    const { result: response } = timing.timeSync('serialization', () =>
      Response.json({
        success: true,
        message: result.message,
        conversationId,
        contextKey: context.contextKey,
      }),
    )
    if (ownsTiming) {
      timing.markPoint('handler_exit')
      timing.logIfSlow()
    }
    return response
  } catch (error) {
    // Handle connection reset errors gracefully (client disconnected)
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'ECONNRESET'
    ) {
      reqLogger.debug({ err: error }, 'Client disconnected during chat request')
      // Return 499 (Client Closed Request) or 200 to avoid error logs
      const { result: response } = timing.timeSync('serialization', () =>
        Response.json({ error: 'Request cancelled' }, { status: 499 }),
      )
      if (ownsTiming) {
        timing.markPoint('handler_exit')
        timing.logIfSlow()
      }
      return response
    }

    reqLogger.error({ err: error }, 'Chat endpoint error')

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

