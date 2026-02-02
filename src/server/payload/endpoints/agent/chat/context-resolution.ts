/**
 * Chat Context Resolution
 * Handles context validation, access checks, and conversation management
 */
import type { Payload } from 'payload'
import type { Logger } from 'pino'

import { AccountRole } from '@/server/payload/collections/Users/roles'
import { ConversationService } from '@/server/services/conversation-service'

import type { ChatRequest, ContextCandidate, ContextRelation } from './request-validation'

/**
 * Context relations that support admin chat (includes categories)
 */
export const ADMIN_CHAT_CONTEXT_RELATIONS: ContextRelation[] = [
  'courses',
  'chapters',
  'lessons',
  'exercises',
  'categories',
]

export interface ResolvedContext {
  contextKey: string
  relationTo: ContextRelation
  value: string
}

export interface ContextValidationResult {
  success: boolean
  error?: string
  statusCode?: number
}

/**
 * Validate that the context document exists and user has access
 */
export async function validateContextExists(
  payload: Payload,
  contextCandidate: ContextCandidate,
  user: { id: string },
  reqLogger: Logger,
): Promise<ContextValidationResult> {
  try {
    const contextResult = await payload.find({
      collection: contextCandidate.relationTo,
      where: { id: { equals: contextCandidate.value } },
      limit: 1,
      depth: 0,
      user,
      overrideAccess: false,
    })

    if (contextResult.docs.length === 0) {
      reqLogger.warn(
        { userId: user.id, context: contextCandidate },
        'Context not found for chat request',
      )
      return { success: false, error: 'Context not found', statusCode: 404 }
    }

    return { success: true }
  } catch (error) {
    reqLogger.warn(
      { err: error, userId: user.id, context: contextCandidate },
      'Invalid context ID in chat request',
    )
    return { success: false, error: 'Invalid context ID', statusCode: 400 }
  }
}

/**
 * Resolve full context using ConversationService
 */
export async function resolveContext(
  conversationService: ConversationService,
  validated: ChatRequest,
): Promise<ResolvedContext> {
  return conversationService.resolveContext({
    exerciseId: validated.exerciseId,
    lessonId: validated.lessonId,
    chapterId: validated.chapterId,
    courseId: validated.courseId,
  }) as Promise<ResolvedContext>
}

/**
 * Validate user has access to the context
 */
export async function validateContextAccess(
  conversationService: ConversationService,
  userId: string,
  userRole: AccountRole,
  context: ResolvedContext,
): Promise<boolean> {
  return conversationService.validateContextAccess(userId, userRole, {
    relationTo: context.relationTo as 'courses' | 'chapters' | 'lessons' | 'exercises',
    value: context.value,
  })
}

/**
 * Get or create conversation for the context
 */
export async function getOrCreateConversation(
  conversationService: ConversationService,
  userId: string,
  context: ResolvedContext,
) {
  return conversationService.getOrCreateActiveConversation(userId, {
    relationTo: context.relationTo as 'courses' | 'chapters' | 'lessons' | 'exercises',
    value: context.value,
  })
}
