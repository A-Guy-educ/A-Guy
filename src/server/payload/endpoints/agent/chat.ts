/**
 * POST /api/agent/chat
 * Chat with AI assistant with context awareness
 *
 * @fileType endpoint
 * @domain chat
 * @pattern authenticated-endpoint, validated-endpoint, context-scoped, admin-mode
 * @ai-summary Chat endpoint with context scoping, memory retrieval, MCP tools for admins, and automatic maintenance
 *
 * Access: Authenticated users only
 *
 * Features:
 * - Context-scoped conversations (Course/Chapter/Lesson/Exercise)
 * - Admin mode with MCP tools (no context required)
 * - Running summary of conversation history
 * - Long-term memory with hierarchical vector search
 * - Automatic maintenance and memory extraction
 */
import { composePrompt, getRecentWindow, type Message } from '@/infra/llm/context-policy'
import { AI_MODELS } from '@/infra/llm/models'
import { createContextLog, logContextUsage, logPromptSnapshot } from '@/infra/llm/observability'
import { generateChatCompletionWithTools } from '@/infra/llm/providers/gemini'
import { chatWithExerciseHelper } from '@/infra/llm/services/exercise-chat-service'
import { logger } from '@/infra/utils/logger'
import { isUsersCollectionUser } from '@/server/payload/access/isUsersCollectionUser'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import { getMCPClient } from '@/server/repos/mcp/client/mcp-client'
import { ConversationService } from '@/server/services/conversation-service'
import type { PayloadRequest } from 'payload'
import { z } from 'zod'

import {
  composeFullSystemInstructions,
  extractContextCandidate,
  fetchLessonContextForContext,
  getOrCreateConversation,
  parseRequestBody,
  processMediaAttachments,
  resolveContext,
  retrieveMemories,
  scheduleMemoryExtraction,
  scheduleSummaryMaintenance,
  validateContextAccess,
  validateContextExists,
} from './chat/index'

// Admin mode types
export interface AdminModeParams {
  adminMode?: boolean
  message: string
  acknowledgment?: string
  conversationId?: string
  mediaIds?: string[]
}

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

    // 3) Check if admin mode
    const isAdmin = (req.user.role as AccountRole) === AccountRole.Admin
    const adminMode = isAdmin && validated.adminMode === true

    // For admin mode, check if we have a context or adminMode
    const contextCandidate = extractContextCandidate(validated)

    // Admin mode without context - use admin:user:{userId} context
    if (adminMode && !contextCandidate) {
      return handleAdminModeChat(req, requestId, validated, reqLogger)
    }

    // Regular mode - context required
    if (!contextCandidate) {
      return Response.json(
        { error: 'Missing context ID (requires exerciseId, lessonId, chapterId, or courseId)' },
        { status: 400 },
      )
    }

    // Continue with regular context-scoped chat...
    return handleContextScopedChat(req, requestId, validated, contextCandidate, reqLogger)
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

/**
 * Handle admin mode chat - no context required, uses users:{userId} conversation
 */
async function handleAdminModeChat(
  req: PayloadRequest,
  requestId: string,
  validated: z.infer<typeof import('./chat/request-validation').chatRequestSchema>,
  reqLogger: typeof logger,
) {
  const userId = req.user?.id
  if (!userId) {
    return Response.json({ error: 'User ID not found' }, { status: 401 })
  }

  // Use users:{userId} context key (user-scoped conversation)
  const contextKey = `users:${userId}`

  reqLogger.info({ userId, contextKey }, 'Processing admin mode chat request')

  // Initialize ConversationService
  const conversationService = new ConversationService(req.payload)

  // Get or create admin conversation
  const conversation = await conversationService.getOrCreateActiveConversation(userId, {
    relationTo: 'users',
    value: userId,
  })
  const conversationId = conversation.id

  reqLogger.info({ conversationId, contextKey }, 'Using admin conversation')

  // Persist user message
  const userMessage = {
    role: 'user' as const,
    content: validated.message,
    timestamp: new Date().toISOString(),
    media: validated.mediaIds?.map((id) => ({ mediaId: id })) || [],
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
    user: req.user,
    overrideAccess: true,
  })

  // Get recent window
  const recentMessages = getRecentWindow(allMessages as Message[])

  // Extract auth headers to forward to MCP client
  const authHeaders: HeadersInit = {}
  if (req.headers) {
    const cookie =
      typeof req.headers.get === 'function' ? req.headers.get('cookie') : undefined
    const authorization =
      typeof req.headers.get === 'function' ? req.headers.get('authorization') : undefined
    if (cookie) authHeaders['cookie'] = cookie
    if (authorization) authHeaders['authorization'] = authorization
  }

  // Get MCP tools for tool calling
  const mcpClient = getMCPClient()
  let tools: Awaited<ReturnType<typeof mcpClient.listTools>> = []
  try {
    tools = await mcpClient.listTools(authHeaders)
    reqLogger.info(
      { toolCount: tools.length, toolNames: tools.map((t) => t.name) },
      'Loaded MCP tools for admin chat',
    )
  } catch (error) {
    reqLogger.error({ err: error }, 'Failed to load MCP tools, proceeding without tool calling')
  }

  // For admin mode, use a system prompt that instructs the AI to use tools
  const systemPrompt = `You are an AI assistant for the admin panel of an educational platform. You have access to database query tools.

IMPORTANT: You MUST use the provided tools to answer questions about data. Do NOT ask clarifying questions - just use the tools to query the database directly.

When the user asks about courses, chapters, lessons, exercises, or media:
1. ALWAYS call the appropriate tool immediately
2. Do NOT ask "which courses?" or "what do you mean?" - just query the database
3. Present the results clearly after receiving tool output

Available tools:
- findCourses: Query courses in the database
- findChapters: Query chapters
- findLessons: Query lessons
- findExercises: Query exercises
- findMedia: Query media files

Example: If user asks "how many courses do we have?", call findCourses immediately and count the results.`

  // Build messages for AI
  const messages = recentMessages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  // If we have tools, use tool calling
  if (tools.length > 0) {
    reqLogger.info({ toolCount: tools.length }, 'Using tool calling for admin chat')

    const modelCallStart = Date.now()
    const result = await generateChatCompletionWithTools(
      {
        system: systemPrompt,
        messages,
        model: AI_MODELS.EXERCISE_CHAT,
        acknowledgment: validated.acknowledgment || 'Understood.',
        tools,
        toolExecutor: async (toolName, args) => {
          reqLogger.debug({ toolName, args }, 'Executing MCP tool')
          try {
            const toolResult = await mcpClient.callTool(toolName, args, authHeaders)
            const content = toolResult.content
            if (Array.isArray(content)) {
              return content.map((c) => (c as { text?: string }).text).join('\n')
            }
            return JSON.stringify(content)
          } catch (error) {
            reqLogger.error({ err: error, toolName, args }, 'Tool execution failed')
            return `Error executing ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        },
      },
      req.payload,
    )
    const modelLatencyMs = Date.now() - modelCallStart

    reqLogger.info(
      { modelLatencyMs, toolCalls: result.toolCalls?.length },
      'Admin chat with tool calling completed',
    )

    // Persist assistant response
    const assistantMessage = {
      role: 'assistant' as const,
      content: result.text || '',
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
      reqLogger.warn({ err: updateError, conversationId }, 'Failed to persist admin response')
    }

    return Response.json({
      success: true,
      message: result.text,
      conversationId,
      contextKey,
    })
  }

  // Fallback: No tools available, use regular chat
  const modelCallStart = Date.now()
  const result = await chatWithExerciseHelper(
    {
      message: validated.message,
      acknowledgment: validated.acknowledgment || '',
      composedPrompt: undefined,
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
    reqLogger.error({ error: result.error, modelLatencyMs }, 'Admin chat request failed')
    return Response.json(
      { error: result.error || 'Failed to process chat message' },
      { status: 500 },
    )
  }

  // Persist assistant response
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
    reqLogger.warn({ err: updateError, conversationId }, 'Failed to persist admin response')
  }

  reqLogger.info('Admin chat request successful (fallback mode)')
  return Response.json({
    success: true,
    message: result.message,
    conversationId,
    contextKey,
  })
}

/**
 * Handle regular context-scoped chat
 */
async function handleContextScopedChat(
  req: PayloadRequest,
  requestId: string,
  validated: z.infer<typeof import('./chat/request-validation').chatRequestSchema>,
  contextCandidate: NonNullable<ReturnType<typeof extractContextCandidate>>,
  reqLogger: typeof logger,
) {
  const userId = req.user?.id
  if (!userId) {
    return Response.json({ error: 'User ID not found' }, { status: 401 })
  }

  // Safely get user role - only Users collection has roles
  const userRole = isUsersCollectionUser(req.user)
    ? ((req.user as unknown as { role: AccountRole }).role as AccountRole)
    : AccountRole.Student

  const contextValidation = await validateContextExists(
    req.payload,
    contextCandidate,
    { id: userId },
    logger as any,
  )
  if (!contextValidation.success) {
    return Response.json(
      { error: contextValidation.error },
      { status: contextValidation.statusCode },
    )
  }

  reqLogger.info(
    {
      userId,
      exerciseId: validated.exerciseId,
      lessonId: validated.lessonId,
      chapterId: validated.chapterId,
      courseId: validated.courseId,
    },
    'Processing chat request',
  )

  // Initialize ConversationService and resolve context
  const conversationService = new ConversationService(req.payload)
  const context = await resolveContext(conversationService, validated)

  reqLogger.info(
    { userId, contextKey: context.contextKey, contextRelation: context.relationTo },
    'Resolved context',
  )

  // Validate context access
  const hasAccess = await validateContextAccess(conversationService, userId, userRole, context)
  if (!hasAccess) {
    return Response.json({ error: 'Unauthorized to access this context' }, { status: 403 })
  }

  // Get or create conversation
  const conversation = await getOrCreateConversation(conversationService, userId, context)
  const conversationId = conversation.id

  reqLogger.info({ conversationId, contextKey: context.contextKey }, 'Using conversation')

  // Persist user message
  const userMessage = {
    role: 'user' as const,
    content: validated.message,
    timestamp: new Date().toISOString(),
    media: validated.mediaIds?.map((id) => ({ mediaId: id })) || [],
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
    user: req.user,
    overrideAccess: true,
  })

  // Get recent window and retrieve memories
  const recentMessages = getRecentWindow(allMessages as Message[])

  const memoryResult = await retrieveMemories(
    req.payload,
    userId,
    conversationId,
    context.contextKey,
    recentMessages,
    logger as any,
  )

  // Fetch lesson context and compose system instructions
  const lessonContext = await fetchLessonContextForContext(
    req.payload,
    context,
    { id: userId },
    logger as any,
    validated.courseId,
  )

  let composedInstructions
  try {
    composedInstructions = await composeFullSystemInstructions(
      req.payload,
      lessonContext.lessonPrompt,
      lessonContext.lessonContextText,
      logger as any,
      lessonContext.coursePrompt,
      lessonContext.courseContextText,
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

  // Validate media attachments
  const mediaResult = await processMediaAttachments(
    req.payload,
    validated.mediaIds || [],
    userId,
    req,
    logger as any,
  )

  if (!mediaResult.success) {
    return Response.json(
      { error: mediaResult.error, details: mediaResult.errorDetails },
      { status: 400 },
    )
  }

  // Compose prompt using Context Policy V1
  const composedPrompt = composePrompt(composedInstructions.instructions, {
    systemMessage: composedInstructions.instructions,
    summary: conversation?.summary || undefined,
    memoryItems: memoryResult.items,
    recentMessages: recentMessages,
  })

  logPromptSnapshot(conversationId, composedPrompt)

  // Call AI service
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

  // Persist assistant response
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
    reqLogger.warn({ err: updateError, conversationId }, 'Failed to persist assistant response')
  }

  // Log context usage
  logContextUsage(
    createContextLog({
      conversationId,
      userId,
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

  // Schedule background tasks
  scheduleSummaryMaintenance(req.payload, conversationId, logger as any)
  if (req.user) {
    scheduleMemoryExtraction(
      req.payload,
      conversationId,
      userId,
      context,
      { id: userId },
      logger as any,
    )
  }

  reqLogger.info('Chat request successful')
  return Response.json({
    success: true,
    message: result.message,
    conversationId,
    contextKey: context.contextKey,
  })
}
