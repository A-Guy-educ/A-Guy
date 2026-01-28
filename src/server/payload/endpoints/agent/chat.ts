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
import { composePrompt, getRecentWindow, type Message } from '@/infra/llm/context-policy'
import { createContextLog, logContextUsage, logPromptSnapshot } from '@/infra/llm/observability'
import { chatWithExerciseHelper } from '@/infra/llm/services/exercise-chat-service'
import { logger } from '@/infra/utils/logger'
import { isUsersCollectionUser } from '@/server/payload/access/isUsersCollectionUser'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import { ConversationService } from '@/server/services/conversation-service'
import { PayloadRequest } from 'payload'
import { z } from 'zod'

import {
  extractContextCandidate,
  parseRequestBody,
  validateContextExists,
  resolveContext,
  validateContextAccess,
  getOrCreateConversation,
  retrieveMemories,
  fetchLessonContextForContext,
  composeFullSystemInstructions,
  processMediaAttachments,
  scheduleSummaryMaintenance,
  scheduleMemoryExtraction,
} from './chat/index'

export async function agentChat(req: PayloadRequest & { json?: () => Promise<unknown> }) {
  const requestId = crypto.randomUUID()
  const reqLogger = logger.child({ requestId })

  // 1) Auth - endpoints not authenticated by default
  if (!req.user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (!isUsersCollectionUser(req.user)) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    // 2) Parse and validate request body
    if (!req.json) {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }

    const parseResult = await parseRequestBody(req.json.bind(req))
    if (!parseResult.success) {
      return Response.json(
        { error: 'Invalid request', details: parseResult.error.issues },
        { status: 400 },
      )
    }

    const validated = parseResult.data

    // 3) Extract and validate context candidate
    const contextCandidate = extractContextCandidate(validated)
    if (!contextCandidate) {
      return Response.json(
        { error: 'Missing context ID (requires exerciseId, lessonId, chapterId, or courseId)' },
        { status: 400 },
      )
    }

    const contextValidation = await validateContextExists(
      req.payload,
      contextCandidate,
      req.user,
      reqLogger,
    )
    if (!contextValidation.success) {
      return Response.json(
        { error: contextValidation.error },
        { status: contextValidation.statusCode },
      )
    }

    reqLogger.info(
      {
        userId: req.user.id,
        exerciseId: validated.exerciseId,
        lessonId: validated.lessonId,
        chapterId: validated.chapterId,
        courseId: validated.courseId,
      },
      'Processing chat request',
    )

    // 4) Initialize ConversationService and resolve context
    const conversationService = new ConversationService(req.payload)
    const context = await resolveContext(conversationService, validated)

    reqLogger.info(
      { userId: req.user.id, contextKey: context.contextKey, contextRelation: context.relationTo },
      'Resolved context',
    )

    // 5) Validate context access
    const hasAccess = await validateContextAccess(
      conversationService,
      req.user.id,
      req.user.role as AccountRole,
      context,
    )
    if (!hasAccess) {
      return Response.json({ error: 'Unauthorized to access this context' }, { status: 403 })
    }

    // 6) Get or create conversation
    const conversation = await getOrCreateConversation(conversationService, req.user.id, context)
    const conversationId = conversation.id

    reqLogger.info({ conversationId, contextKey: context.contextKey }, 'Using conversation')

    // 7) Persist user message
    const userMessage = {
      role: 'user' as const,
      content: validated.message,
      timestamp: new Date().toISOString(),
      media: validated.mediaIds?.map((id) => ({ mediaId: id })) || [],
    }

    reqLogger.info(
      {
        userMessageMedia: userMessage.media,
        mediaCount: userMessage.media.length,
      },
      '[DEBUG] User message before save',
    )

    const conversationHistory = conversation.messages || []
    const allMessages = [...conversationHistory, userMessage]

    const updateResult = await req.payload.update({
      collection: 'conversations',
      id: conversationId,
      data: {
        messages: allMessages,
        lastMessageAt: new Date().toISOString(),
      },
      user: req.user,
      overrideAccess: true,
    })

    reqLogger.info(
      {
        savedMessages: updateResult.messages?.slice(-1).map((m) => ({
          role: m.role,
          hasMedia: !!m.media,
          mediaCount: m.media?.length || 0,
          media: m.media,
        })),
      },
      '[DEBUG] Message after save',
    )

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

    // 8) Get recent window and retrieve memories
    const recentMessages = getRecentWindow(allMessages as Message[])
    reqLogger.info({ recentCount: recentMessages.length }, '[DEBUG] Recent window extracted')

    const memoryResult = await retrieveMemories(
      req.payload,
      req.user.id,
      conversationId,
      context.contextKey,
      recentMessages,
      reqLogger,
    )

    // 9) Fetch lesson context and compose system instructions
    const lessonContext = await fetchLessonContextForContext(
      req.payload,
      context,
      req.user,
      reqLogger,
    )

    let composedInstructions
    try {
      composedInstructions = await composeFullSystemInstructions(
        req.payload,
        lessonContext.lessonPrompt,
        lessonContext.lessonContextText,
        reqLogger,
      )
    } catch (error) {
      if (error instanceof Error && error.message.includes('exceeds maximum')) {
        return Response.json(
          { error: 'Lesson context exceeds maximum allowed size' },
          { status: 400 },
        )
      }
      throw error
    }

    // 10) Validate media attachments
    const mediaResult = await processMediaAttachments(
      req.payload,
      validated.mediaIds || [],
      req.user.id,
      req,
      reqLogger,
    )

    if (!mediaResult.success) {
      return Response.json(
        { error: mediaResult.error, details: mediaResult.errorDetails },
        { status: 400 },
      )
    }

    // 11) Compose prompt using Context Policy V1
    const composedPrompt = composePrompt(composedInstructions.instructions, {
      systemMessage: composedInstructions.instructions,
      summary: conversation?.summary || undefined,
      memoryItems: memoryResult.items,
      recentMessages: recentMessages,
    })

    logPromptSnapshot(conversationId, composedPrompt)

    // 12) Call AI service
    const modelCallStart = Date.now()
    const result = await chatWithExerciseHelper(
      {
        message: validated.message,
        acknowledgment: validated.acknowledgment,
        composedPrompt: composedPrompt,
        mediaPartsWithPath:
          mediaResult.mediaPartsWithPath.length > 0 ? mediaResult.mediaPartsWithPath : undefined,
        req: {
          headers: {
            authorization:
              (req.headers && typeof req.headers.get === 'function'
                ? req.headers.get('authorization')
                : undefined) || undefined,
            cookie:
              (req.headers && typeof req.headers.get === 'function'
                ? req.headers.get('cookie')
                : undefined) || undefined,
          },
        },
      },
      req.payload,
    )
    const modelLatencyMs = Date.now() - modelCallStart

    if (!result.success) {
      reqLogger.error({ error: result.error, modelLatencyMs }, 'Chat request failed')
      return Response.json(
        { error: result.error || 'Failed to process chat message' },
        { status: 500 },
      )
    }

    // 13) Persist assistant response
    const assistantMessage = {
      role: 'assistant' as const,
      content: result.message || '',
      timestamp: new Date().toISOString(),
    }

    const updatedMessages = [...allMessages, assistantMessage]

    try {
      await req.payload.update({
        collection: 'conversations',
        id: conversationId,
        data: {
          messages: updatedMessages,
          lastMessageAt: new Date().toISOString(),
        },
        user: req.user,
        overrideAccess: true,
      })
    } catch (updateError) {
      // Handle race condition where conversation was modified/deleted during long AI call
      reqLogger.warn(
        { err: updateError, conversationId },
        'Failed to persist assistant response - conversation may have been modified',
      )
      // Still return the AI response to the user even if persistence failed
    }

    // 14) Log context usage
    logContextUsage(
      createContextLog({
        conversationId,
        userId: req.user.id,
        policyVersion: composedPrompt.metadata.policyVersion,
        summaryPresent: !!conversation?.summary,
        summaryLength: composedPrompt.metadata.summaryLength,
        memoryLocalCount: memoryResult.localCount,
        memoryContextCount: memoryResult.contextCount,
        memoryGlobalCount: memoryResult.globalCount,
        memoryRetrievalLatencyMs: memoryResult.latencyMs,
        messageWindowSize: composedPrompt.metadata.messageCount,
        messageTotalCount: updatedMessages.length,
        modelLatencyMs,
        hierarchyKeys: memoryResult.hierarchyKeys,
      }),
    )

    // 15) Schedule background tasks
    scheduleSummaryMaintenance(req.payload, conversationId, reqLogger)
    scheduleMemoryExtraction(req.payload, conversationId, req.user.id, context, req.user, reqLogger)

    reqLogger.info('Chat request successful')
    return Response.json({
      success: true,
      message: result.message,
      conversationId,
      contextKey: context.contextKey,
    })
  } catch (error) {
    // Handle connection reset errors gracefully
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'ECONNRESET'
    ) {
      reqLogger.debug({ err: error }, 'Client disconnected during chat request')
      return Response.json({ error: 'Request cancelled' }, { status: 499 })
    }

    reqLogger.error({ err: error }, 'Chat endpoint error')

    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Invalid request', details: error.issues }, { status: 400 })
    }

    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
