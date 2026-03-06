/**
 * POST /api/agent/chat
 * Chat with AI assistant with context awareness
 *
 * @fileType endpoint
 * @domain chat
 * @pattern authenticated-endpoint, validated-endpoint, context-scoped, admin-mode, guest-session
 * @ai-summary Chat endpoint with context scoping, memory retrieval, MCP tools for admins, guest sessions, and automatic maintenance
 *
 * Access: Authenticated users OR guest sessions
 *
 * Features:
 * - Guest sessions for anonymous users (7-day sliding TTL, 30-day hard cap)
 * - Context-scoped conversations (Course/Chapter/Lesson/Exercise)
 * - Admin mode with MCP tools (no context required)
 * - Running summary of conversation history
 * - Long-term memory with hierarchical vector search
 * - Automatic maintenance and memory extraction
 */
import { composePrompt, getRecentWindow, type Message } from '@/infra/llm/context-policy'
import { createContextLog, logContextUsage, logPromptSnapshot } from '@/infra/llm/observability'
import {
  detectBestProvider,
  getLLMProvider,
  getProviderModelConfig,
} from '@/infra/llm/providers/factory'
import { chatWithExerciseHelper } from '@/infra/llm/services/exercise-chat-service'
import { logger } from '@/infra/utils/logger'
import { isUsersCollectionUser } from '@/server/payload/access/isUsersCollectionUser'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import { getMCPClient } from '@/server/repos/mcp/client/mcp-client'
import {
  ConversationService,
  GuestConversationLimitError,
} from '@/server/services/conversation-service'
import {
  buildGuestSessionCookieHeader,
  checkAndIncrementGuestMessageCount,
  createGuestSession,
  getGuestSessionByToken,
  getGuestSessionCookie,
  hashIP,
  hashUserAgent,
} from '@/server/services/guest-session'
import { checkRateLimit } from '@/server/services/rate-limit'
import type { PayloadRequest } from 'payload'
import type { Logger } from 'pino'
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

// Maximum messages to keep in conversation (leaves room for assistant response within 100 limit)
const MAX_MESSAGES_BEFORE_ASSISTANT = 95

/**
 * Trim messages array to stay within maxRows limit
 */
interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  media?: Array<{ mediaId: string }>
}

function trimMessagesForUpdate(messages: Message[]): ConversationMessage[] {
  return messages.slice(-MAX_MESSAGES_BEFORE_ASSISTANT).map((m) => ({
    role: m.role,
    content: m.content,
    timestamp: typeof m.timestamp === 'string' ? m.timestamp : m.timestamp.toISOString(),
    media: (m as unknown as { media?: Array<{ mediaId: string }> })?.media,
  }))
}

export async function agentChat(req: PayloadRequest & { json?: () => Promise<unknown> }) {
  const requestId = crypto.randomUUID()
  const reqLogger = logger.child({ requestId })

  let guestSession: Awaited<ReturnType<typeof getGuestSessionByToken>> | null = null
  let isGuestMode = false
  let guestCookieHeader: string | undefined

  // 1) Auth - check for authenticated user OR guest session
  // req.user is set by Payload middleware for real HTTP requests.
  // Fall back to payload.auth() for cases where middleware hasn't run.
  let user = req.user
  if (!user) {
    const authResult = await req.payload.auth({ headers: req.headers })
    user = authResult.user
  }

  if (!user) {
    // Check for guest session
    const guestToken = getGuestSessionCookie(req.headers as unknown as Headers)
    if (guestToken) {
      guestSession = await getGuestSessionByToken(req.payload, guestToken)
    }

    if (!guestSession) {
      // Create new guest session
      const ipHash = hashIP(req.headers?.get('x-forwarded-for') || req.headers?.get('x-real-ip'))
      const userAgentHash = hashUserAgent(req.headers?.get('user-agent'))

      // Check rate limit for new guests
      const rateLimitResult = await checkRateLimit(ipHash, userAgentHash)
      if (!rateLimitResult.allowed) {
        return Response.json(
          {
            error: 'Too many requests. Please try again later.',
            isGuestMode: true,
            retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
              'X-RateLimit-Remaining': String(rateLimitResult.remaining),
              'X-RateLimit-Reset': String(rateLimitResult.resetAt),
            },
          },
        )
      }

      const { session, token } = await createGuestSession(req.payload, {
        ipHash,
        userAgentHash,
      })
      guestSession = session
      isGuestMode = true

      guestCookieHeader = await buildGuestSessionCookieHeader(token)
    } else {
      isGuestMode = true
    }
  }

  // No auth at all - reject
  if (!user && !guestSession) {
    return Response.json(
      { error: 'Authentication or guest session required', isGuestMode: false },
      { status: 401 },
    )
  }

  if (!user && guestSession) {
    reqLogger.info({ guestSessionId: guestSession.id }, 'Processing guest chat request')

    const messageLimit = await checkAndIncrementGuestMessageCount(req.payload, guestSession.id)
    if (!messageLimit.allowed) {
      return Response.json(
        {
          error: 'Guest message limit reached. Sign up for unlimited access.',
          isGuestMode: true,
          retryAfter: null,
        },
        {
          status: 429,
          headers: {
            'X-Guest-Message-Limit': 'true',
          },
        },
      )
    }
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

    // Safely extract user info (may be null for guests)
    const userId = user?.id
    const userRole = isUsersCollectionUser(user)
      ? ((user as unknown as { role: AccountRole }).role as AccountRole)
      : AccountRole.Student
    const isAdmin = userRole === AccountRole.Admin

    // 3) Check if admin mode (guests cannot use admin mode)
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
    return handleContextScopedChat(
      req,
      requestId,
      validated,
      contextCandidate,
      reqLogger,
      userId,
      guestSession?.id,
      isGuestMode,
      guestCookieHeader,
    )
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
    chatAssets: validated.chatAssetIds?.map((id) => ({ chatAssetId: id })) || [],
  }

  const conversationHistory = conversation.messages || []
  const allMessages = [...trimMessagesForUpdate(conversationHistory), userMessage]

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

  // Get recent window
  const recentMessages = getRecentWindow(allMessages as Message[])

  // Extract auth headers to forward to MCP client
  const authHeaders: HeadersInit = {}
  if (req.headers) {
    const cookie = typeof req.headers.get === 'function' ? req.headers.get('cookie') : undefined
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
  const systemPrompt = `You are an AI assistant for the admin panel of an educational platform. You have access to database query and creation tools.

IMPORTANT: You MUST use the provided tools to answer questions about data and create new content. Do NOT ask clarifying questions - just use the tools to interact with the database directly.

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
- createCourses: Create a new course
- createChapters: Create a new chapter in a course
- createLessons: Create a new lesson in a chapter

Example: If user asks "how many courses do we have?", call findCourses immediately and count the results.
Example: If user asks "create a new course about Python programming", call createCourses with appropriate data.`

  // Build messages for AI
  const messages = recentMessages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  // If we have tools, use tool calling
  if (tools.length > 0) {
    reqLogger.info({ toolCount: tools.length }, 'Using tool calling for admin chat')

    // Get provider from factory (respects LLM_PROVIDER env var)
    // Use detectBestProvider to get the actual provider type based on availability
    const providerType = await detectBestProvider(req.payload)
    const provider = await getLLMProvider(req.payload)
    const modelConfig = await getProviderModelConfig(providerType, 'EXERCISE_CHAT')

    const modelCallStart = Date.now()
    const result = await provider.generateChatCompletionWithTools(
      {
        system: systemPrompt,
        messages,
        model: modelConfig,
        acknowledgment: validated.acknowledgment || 'Understood.',
        tools,
        toolExecutor: async (toolName: string, args: Record<string, unknown>) => {
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

    const updatedMessages = [...trimMessagesForUpdate(allMessages), assistantMessage]

    try {
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

  const updatedMessages = [...trimMessagesForUpdate(allMessages), assistantMessage]

  try {
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
  userId: string | undefined,
  guestSessionId: string | undefined,
  isGuestMode: boolean,
  guestCookieHeader?: string,
) {
  // Helper to build response with optional Set-Cookie header
  const jsonWithCookie = (
    body: Record<string, unknown>,
    options?: { status?: number; cookieHeader?: string },
  ): Response => {
    const headers: HeadersInit = {}
    if (options?.cookieHeader) {
      headers['Set-Cookie'] = options.cookieHeader
    }
    return Response.json(body, { status: options?.status, headers })
  }

  // Require either authenticated user or guest session
  if (!userId && !guestSessionId) {
    return jsonWithCookie(
      { error: 'User ID or guest session required', isGuestMode: false },
      { status: 401 },
    )
  }

  const userRole =
    userId && isUsersCollectionUser(req.user)
      ? ((req.user as unknown as { role: AccountRole }).role as AccountRole)
      : AccountRole.Student

  // Determine owner ID (user or guest session)
  const ownerId = userId ?? guestSessionId!

  const contextValidation = await validateContextExists(
    req.payload,
    contextCandidate,
    { id: ownerId },
    logger as Logger,
  )
  if (!contextValidation.success) {
    return jsonWithCookie(
      { error: contextValidation.error, isGuestMode },
      { status: contextValidation.statusCode, cookieHeader: guestCookieHeader },
    )
  }

  reqLogger.info(
    {
      userId,
      guestSessionId,
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

  // Add guestSessionId to context if applicable
  if (guestSessionId) {
    ;(context as { guestSessionId?: string }).guestSessionId = guestSessionId
  }

  reqLogger.info(
    { ownerId, contextKey: context.contextKey, contextRelation: context.relationTo, isGuestMode },
    'Resolved context',
  )

  // Validate context access
  const hasAccess = await validateContextAccess(
    conversationService,
    ownerId,
    userRole,
    context as Parameters<typeof validateContextAccess>[3],
  )
  if (!hasAccess) {
    return jsonWithCookie(
      { error: 'Unauthorized to access this context', isGuestMode },
      { status: 403, cookieHeader: guestCookieHeader },
    )
  }

  // Get or create conversation (supports guests)
  let conversation
  try {
    conversation = await getOrCreateConversation(
      conversationService,
      ownerId,
      context as Parameters<typeof getOrCreateConversation>[2],
      guestSessionId,
    )
  } catch (error) {
    if (error instanceof GuestConversationLimitError) {
      return jsonWithCookie(
        { error: error.message, code: 'GUEST_LIMIT_REACHED', isGuestMode },
        { status: 403, cookieHeader: guestCookieHeader },
      )
    }
    throw error
  }
  const conversationId = conversation.id

  reqLogger.info(
    { conversationId, contextKey: context.contextKey, isGuestMode },
    'Using conversation',
  )

  // Persist user message
  const userMessage = {
    role: 'user' as const,
    content: validated.message,
    timestamp: new Date().toISOString(),
    media: validated.mediaIds?.map((id) => ({ mediaId: id })) || [],
    chatAssets: validated.chatAssetIds?.map((id) => ({ chatAssetId: id })) || [],
  }

  const conversationHistory = conversation.messages || []
  const allMessages = [...trimMessagesForUpdate(conversationHistory), userMessage]

  // Use overrideAccess: false for authenticated users, true for guests (ownership already validated)
  await req.payload.update({
    collection: 'conversations',
    id: conversationId,
    data: {
      messages: allMessages,
      lastMessageAt: new Date().toISOString(),
    },
    user: req.user,
    overrideAccess: !userId, // false for authenticated users, true for guests
  })

  // Get recent window and retrieve memories
  const recentMessages = getRecentWindow(allMessages as Message[])

  const memoryResult = await retrieveMemories(
    req.payload,
    ownerId,
    conversationId,
    context.contextKey,
    recentMessages,
    logger as Logger,
  )

  // Fetch lesson context and compose system instructions
  const lessonContext = await fetchLessonContextForContext(
    req.payload,
    context,
    { id: ownerId },
    logger as Logger,
    validated.courseId,
  )

  let composedInstructions
  try {
    composedInstructions = await composeFullSystemInstructions(
      req.payload,
      lessonContext.lessonPrompt,
      lessonContext.lessonContextText,
      logger as Logger,
      lessonContext.coursePrompt,
      lessonContext.courseContextText,
      userId,
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('exceeds maximum')) {
      return jsonWithCookie(
        { error: 'Lesson context exceeds maximum allowed size' },
        { status: 400, cookieHeader: guestCookieHeader },
      )
    }
    throw error
  }

  // Validate media attachments
  const mediaResult = await processMediaAttachments(
    req.payload,
    validated.mediaIds || [],
    ownerId,
    req,
    logger as Logger,
  )

  if (!mediaResult.success) {
    return jsonWithCookie(
      { error: mediaResult.error, details: mediaResult.errorDetails },
      { status: 400, cookieHeader: guestCookieHeader },
    )
  }

  // Compose prompt using Context Policy V1
  const basePrompt = composePrompt(composedInstructions.instructions, {
    systemMessage: composedInstructions.instructions,
    summary: conversation?.summary || undefined,
    memoryItems: memoryResult.items,
    recentMessages: recentMessages,
  })

  // Thread teacher profile metadata for downstream debug logging (immutable)
  const composedPrompt = {
    ...basePrompt,
    metadata: {
      ...basePrompt.metadata,
      teacherProfileSlug: composedInstructions.teacherProfileSlug,
      teacherProfileResolvedFrom: composedInstructions.teacherProfileResolvedFrom,
    },
  }

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
    return jsonWithCookie(
      { error: result.error || 'Failed to process chat message' },
      { status: 500, cookieHeader: guestCookieHeader },
    )
  }

  // Persist assistant response
  const assistantMessage = {
    role: 'assistant' as const,
    content: result.message || '',
    timestamp: new Date().toISOString(),
  }

  const updatedMessages = [...trimMessagesForUpdate(allMessages), assistantMessage]

  try {
    // Use overrideAccess: false for authenticated users, true for guests (ownership already validated)
    await req.payload.update({
      collection: 'conversations',
      id: conversationId,
      data: {
        messages: updatedMessages,
        lastMessageAt: new Date().toISOString(),
      },
      user: req.user,
      overrideAccess: !userId, // false for authenticated users, true for guests
    })
  } catch (updateError) {
    reqLogger.warn({ err: updateError, conversationId }, 'Failed to persist assistant response')
  }

  // Log context usage
  logContextUsage(
    createContextLog({
      conversationId,
      userId: ownerId,
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
  scheduleSummaryMaintenance(req.payload, conversationId, logger as Logger)
  if (ownerId) {
    scheduleMemoryExtraction(
      req.payload,
      conversationId,
      ownerId,
      context,
      { id: ownerId },
      logger as Logger,
    )
  }

  reqLogger.info('Chat request successful')

  return jsonWithCookie(
    {
      success: true,
      message: result.message,
      conversationId,
      contextKey: context.contextKey,
      isGuestMode,
    },
    { cookieHeader: guestCookieHeader },
  )
}
