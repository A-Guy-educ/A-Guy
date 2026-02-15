/**
 * Chat Pipeline Module
 * Extracts the shared pre-LLM pipeline for both streaming and non-streaming chat endpoints
 *
 * @fileType module
 * @domain chat
 * @pattern pipeline, extraction
 */
import { composePrompt, getRecentWindow, type Message } from '@/infra/llm/context-policy'
import { logger } from '@/infra/utils/logger'
import { isUsersCollectionUser } from '@/server/payload/access/isUsersCollectionUser'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import {
  ConversationService,
  GuestConversationLimitError,
} from '@/server/services/conversation-service'
import type { PayloadRequest } from 'payload'
import { z } from 'zod'
import {
  composeFullSystemInstructions,
  extractContextCandidate,
  fetchLessonContextForContext,
  getOrCreateConversation,
  processMediaAttachments,
  resolveContext,
  retrieveMemories,
  validateContextAccess,
  validateContextExists,
  type ContextCandidate,
} from './index'

import type { ComposedPrompt } from '@/infra/llm/context-policy'
import type { ChatMessage } from '@/infra/llm/services/exercise-chat-service'

// Maximum messages to keep in conversation
const MAX_MESSAGES_BEFORE_ASSISTANT = 95

/**
 * Trim messages array to stay within maxRows limit
 */
export function trimMessagesForUpdatePipeline(messages: Message[]): ChatMessage[] {
  return messages.slice(-MAX_MESSAGES_BEFORE_ASSISTANT).map((m) => ({
    role: m.role,
    content: m.content,
    timestamp: typeof m.timestamp === 'string' ? m.timestamp : m.timestamp.toISOString(),
    media: (m as unknown as { media?: Array<{ mediaId: string }> })?.media,
    ...((m as unknown as { hidden?: boolean })?.hidden && { hidden: true }),
  }))
}

/**
 * Result of the chat pipeline
 */
export interface ChatPipelineResult {
  conversationId: string
  context: { contextKey: string; relationTo: string }
  allMessages: ChatMessage[]
  composedPrompt: ComposedPrompt
  memoryResult: Awaited<ReturnType<typeof retrieveMemories>>
  conversation: {
    id: string
    summary?: string
    messages?: Message[]
  }
}

/**
 * Run the shared chat pipeline
 * Returns either ChatPipelineResult on success, or a Response on error (4xx)
 */
export async function runChatPipeline(
  req: PayloadRequest,
  requestId: string,
  validated: z.infer<typeof import('./request-validation').chatRequestSchema>,
  contextCandidate: ContextCandidate,
  reqLogger: typeof logger,
  guestSessionId?: string,
): Promise<{ result: ChatPipelineResult } | { response: Response }> {
  const userId = req.user?.id

  // Require either authenticated user or guest session
  if (!userId && !guestSessionId) {
    return {
      response: Response.json({ error: 'User ID or guest session required' }, { status: 401 }),
    }
  }

  // Safely get user role
  const userRole =
    userId && isUsersCollectionUser(req.user)
      ? ((req.user as unknown as { role: AccountRole }).role as AccountRole)
      : AccountRole.Student

  // Determine owner ID (user or guest session)
  const ownerId = userId ?? guestSessionId!

  // Validate context exists
  const contextValidation = await validateContextExists(
    req.payload,
    contextCandidate,
    { id: ownerId },
    reqLogger as any,
  )
  if (!contextValidation.success) {
    return {
      response: Response.json(
        { error: contextValidation.error },
        { status: contextValidation.statusCode },
      ),
    }
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

  reqLogger.info(
    {
      ownerId,
      contextKey: context.contextKey,
      contextRelation: context.relationTo,
      guestSessionId,
    },
    'Resolved context',
  )

  // Validate context access
  const hasAccess = await validateContextAccess(
    conversationService,
    ownerId,
    userRole,
    context,
    guestSessionId,
  )
  if (!hasAccess) {
    return {
      response: Response.json({ error: 'Unauthorized to access this context' }, { status: 403 }),
    }
  }

  // Get or create conversation (supports guests)
  let conversation
  try {
    conversation = await getOrCreateConversation(
      conversationService,
      ownerId,
      context,
      guestSessionId,
    )
  } catch (error) {
    if (error instanceof GuestConversationLimitError) {
      return {
        response: Response.json(
          { error: error.message, code: 'GUEST_LIMIT_REACHED', isGuestMode: !!guestSessionId },
          { status: 403 },
        ),
      }
    }
    throw error
  }
  const conversationId = conversation.id

  reqLogger.info({ conversationId, contextKey: context.contextKey }, 'Using conversation')

  // Persist user message (optionally hidden for contextual help prompts)
  const userMessage = {
    role: 'user' as const,
    content: validated.message,
    timestamp: new Date().toISOString(),
    media: validated.mediaIds?.map((id: string) => ({ mediaId: id })) || [],
    ...(validated.hidden && { hidden: true }),
  }

  const conversationHistory = conversation.messages || []
  const allMessages = [...trimMessagesForUpdatePipeline(conversationHistory), userMessage]

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
    ownerId,
    conversationId,
    context.contextKey,
    recentMessages,
    reqLogger as any,
  )

  // Fetch lesson context and compose system instructions
  const lessonContext = await fetchLessonContextForContext(
    req.payload,
    context,
    { id: ownerId },
    reqLogger as any,
    validated.courseId,
  )

  let composedInstructions
  try {
    composedInstructions = await composeFullSystemInstructions(
      req.payload,
      lessonContext.lessonPrompt,
      lessonContext.lessonContextText,
      reqLogger as any,
      lessonContext.coursePrompt,
      lessonContext.courseContextText,
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('exceeds maximum')) {
      return {
        response: Response.json(
          { error: 'Lesson context exceeds maximum allowed size' },
          { status: 400 },
        ),
      }
    }
    throw error
  }

  // Validate media attachments
  const mediaResult = await processMediaAttachments(
    req.payload,
    validated.mediaIds || [],
    ownerId,
    req,
    reqLogger as any,
  )

  if (!mediaResult.success) {
    return {
      response: Response.json(
        { error: mediaResult.error, details: mediaResult.errorDetails },
        { status: 400 },
      ),
    }
  }

  // Compose prompt using Context Policy V1
  const composedPrompt = composePrompt(composedInstructions.instructions, {
    systemMessage: composedInstructions.instructions,
    summary: conversation?.summary || undefined,
    memoryItems: memoryResult.items,
    recentMessages: recentMessages,
  })

  return {
    result: {
      conversationId,
      context,
      allMessages,
      composedPrompt,
      memoryResult,
      conversation: {
        id: conversation.id,
        summary: conversation.summary,
        messages: conversation.messages,
      },
    },
  }
}

/**
 * Persist assistant message after chat completion
 */
export async function persistAssistantMessage(
  payload: PayloadRequest['payload'],
  conversationId: string,
  allMessages: ChatMessage[],
  assistantContent: string,
  reqUser: PayloadRequest['user'],
): Promise<void> {
  const assistantMessage = {
    role: 'assistant' as const,
    content: assistantContent,
    timestamp: new Date().toISOString(),
  }

  const updatedMessages = [
    ...trimMessagesForUpdatePipeline(allMessages as unknown as Message[]),
    assistantMessage,
  ]

  await payload.update({
    collection: 'conversations',
    id: conversationId,
    data: {
      messages: updatedMessages,
      lastMessageAt: new Date().toISOString(),
    },
    user: reqUser,
    overrideAccess: true,
  })
}

/**
 * Extract context candidate from validated request
 */
export function extractPipelineContextCandidate(
  validated: z.infer<typeof import('./request-validation').chatRequestSchema>,
): ContextCandidate | null {
  return extractContextCandidate(validated)
}
