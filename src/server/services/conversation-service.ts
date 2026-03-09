/**
 * Conversation Service
 * Core business logic for context-scoped conversations
 *
 * @fileType service
 * @domain chat
 * @pattern service-layer, context-scoped
 * @ai-summary Service for managing conversations with context scoping and access control
 *
 * Responsibilities:
 * - Enforce single active conversation per user+context (DB index guarantee)
 * - Handle context resolution with priority rules (Exercise > Lesson > Chapter > Course)
 * - Support conversation reset (archive + create new)
 * - Validate enrollment/ownership for access control
 */
import { logger } from '@/infra/utils/logger'
import { getGuestChatConfig } from '@/server/config/guest-chat-config'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import { DEFAULT_CONTENT_LOCALE } from '@/server/payload/fields/contentLocale'
import type { ContentLocale } from '@/server/payload/fields/contentLocale'
import type { Payload, PayloadRequest } from 'payload'

export class GuestConversationLimitError extends Error {
  constructor(limit: number) {
    super(
      `Guest session has reached the maximum of ${limit} conversations. Please sign up to continue.`,
    )
    this.name = 'GuestConversationLimitError'
  }
}

export class GuestSessionClaimingError extends Error {
  constructor() {
    super('Guest session is currently being claimed. Please try again.')
    this.name = 'GuestSessionClaimingError'
  }
}

/**
 * Context reference shape for polymorphic relationships
 */
export interface ContextRef {
  relationTo: 'courses' | 'chapters' | 'lessons' | 'exercises' | 'categories' | 'users'
  value: string
}

/**
 * Result of context resolution
 */
export interface ResolvedContext {
  relationTo: ContextRef['relationTo']
  value: string
  contextKey: string
  guestSessionId?: string
}

/**
 * Chat message shape
 */
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  hidden?: boolean
}

/**
 * Conversation with messages and summary
 */
export interface ConversationWithHistory {
  id: string
  user: string | { id: string }
  guestSession?: string
  contextKey: string
  messages: ChatMessage[]
  summary?: string
  summaryUpdatedAt?: string
  summaryUntilTimestamp?: string
}

export class ConversationService {
  private payload: Payload

  constructor(payload: Payload) {
    this.payload = payload
  }

  /**
   * Get or create active conversation for context
   * Enforces single active conversation per user+context
   */
  async getOrCreateActiveConversation(
    userId: string,
    contextRef: ContextRef,
    contextKeyOverride?: string,
    req?: PayloadRequest,
    preferredLocale?: ContentLocale,
  ): Promise<ConversationWithHistory> {
    const contextKey = contextKeyOverride || `${contextRef.relationTo}:${contextRef.value}`

    // Try to find existing active conversation
    const existingConv = await this.payload.find({
      collection: 'conversations',
      where: {
        and: [
          { user: { equals: userId } },
          { contextKey: { equals: contextKey } },
          { archivedAt: { exists: false } },
        ],
      },
      limit: 1,
      ...(req && { req }),
    })

    if (existingConv.docs.length > 0) {
      logger.info(
        { userId, contextKey, conversationId: existingConv.docs[0].id },
        'Found existing active conversation',
      )
      return existingConv.docs[0] as unknown as ConversationWithHistory
    }

    // Create new conversation
    // INVARIANT: Active = archivedAt field is MISSING. Do NOT set archivedAt.
    const newConv = await this.payload.create({
      collection: 'conversations',
      data: {
        user: userId,
        contextRef: {
          relationTo: contextRef.relationTo,
          value: contextRef.value,
        },
        contextKey,
        preferredLocale: preferredLocale ?? DEFAULT_CONTENT_LOCALE,
        messages: [],
        lastMessageAt: new Date(),
        contextPolicyVersion: 'v1',
        // Do NOT set archivedAt - active conversations must NOT have this field
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      draft: false,
      ...(req && { req }),
    })

    logger.info({ userId, contextKey, conversationId: newConv.id }, 'Created new conversation')
    return newConv as unknown as ConversationWithHistory
  }

  /**
   * Archive current conversation and create new one
   * Preserves contextKey for continuity
   */
  async resetConversation(
    userId: string,
    contextKey: string,
    req?: PayloadRequest,
  ): Promise<ConversationWithHistory> {
    // Find and archive the current active conversation
    const existingConv = await this.payload.find({
      collection: 'conversations',
      where: {
        and: [
          { user: { equals: userId } },
          { contextKey: { equals: contextKey } },
          { archivedAt: { exists: false } },
        ],
      },
      limit: 1,
      ...(req && { req }),
    })

    // Carry forward preferredLocale from the archived conversation
    let carryLocale: ContentLocale = DEFAULT_CONTENT_LOCALE
    if (existingConv.docs.length > 0) {
      const currentConv = existingConv.docs[0]
      carryLocale = (currentConv.preferredLocale as ContentLocale) ?? DEFAULT_CONTENT_LOCALE
      // INVARIANT: Archive by setting archivedAt. Requires overrideAccess: true and allowArchive context flag.
      await this.payload.update({
        collection: 'conversations',
        id: currentConv.id,
        data: {
          archivedAt: new Date(),
        } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        overrideAccess: true, // REQUIRED - field access blocks normal mutations
        context: { allowArchive: true }, // REQUIRED - hook protection requires this flag
        ...(req && { req }),
      })
      logger.info(
        { userId, contextKey, conversationId: currentConv.id },
        'Archived current conversation',
      )
    }

    // Parse contextKey to get contextRef
    const [relationTo, value] = contextKey.split(':') as [ContextRef['relationTo'], string]

    // Create new conversation with same context
    // INVARIANT: Active = archivedAt field is MISSING. Do NOT set archivedAt.
    const newConv = await this.payload.create({
      collection: 'conversations',
      data: {
        user: userId,
        contextRef: {
          relationTo,
          value,
        },
        contextKey,
        preferredLocale: carryLocale,
        messages: [],
        lastMessageAt: new Date(),
        contextPolicyVersion: 'v1',
        // Do NOT set archivedAt - active conversations must NOT have this field
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      draft: false,
      ...(req && { req }),
    })

    logger.info(
      { userId, contextKey, conversationId: newConv.id },
      'Created new conversation after reset',
    )
    return newConv as unknown as ConversationWithHistory
  }

  /**
   * Resolve context from UI state
   * Priority: Lesson > Exercise (resolves to parent lesson) > Chapter > Course > Category
   * Exercises within the same lesson share a single conversation.
   * When only exerciseId is provided, the parent lesson is looked up from DB.
   */
  async resolveContext(
    params: {
      exerciseId?: string
      lessonId?: string
      chapterId?: string
      courseId?: string
      categoryId?: string
    },
    req?: PayloadRequest,
  ): Promise<ResolvedContext> {
    // Priority order: Exercise > Lesson > Chapter > Course > Category
    if (params.exerciseId) {
      // Look up the parent lesson so all exercises in the same lesson share one conversation
      const exercise = await this.payload.findByID({
        collection: 'exercises',
        id: params.exerciseId,
        depth: 0,
        ...(req && { req }),
      })
      const lessonId =
        typeof exercise.lesson === 'string'
          ? exercise.lesson
          : (exercise.lesson as { id?: string })?.id
      if (lessonId) {
        return {
          relationTo: 'lessons',
          value: lessonId,
          contextKey: `lessons:${lessonId}`,
        }
      }
      // Fallback if lesson relationship is somehow missing
      return {
        relationTo: 'exercises',
        value: params.exerciseId,
        contextKey: `exercises:${params.exerciseId}`,
      }
    }

    if (params.lessonId) {
      return {
        relationTo: 'lessons',
        value: params.lessonId,
        contextKey: `lessons:${params.lessonId}`,
      }
    }

    if (params.chapterId) {
      return {
        relationTo: 'chapters',
        value: params.chapterId,
        contextKey: `chapters:${params.chapterId}`,
      }
    }

    if (params.courseId) {
      return {
        relationTo: 'courses',
        value: params.courseId,
        contextKey: `courses:${params.courseId}`,
      }
    }

    if (params.categoryId) {
      return {
        relationTo: 'categories',
        value: params.categoryId,
        contextKey: `categories:${params.categoryId}`,
      }
    }

    throw new Error('No context provided')
  }

  /**
   * Validate context access for a user
   * Checks enrollment/ownership for the target context
   *
   * NOTE: This implementation assumes open access for now.
   * In production, this should check actual enrollment data.
   *
   * TODO: Implement based on your enrollment model
   * - Check Enrollments collection
   * - Or check User.enrolledCourses field
   * - Or check Course.students relationship
   */
  async validateContextAccess(
    userId: string,
    userRole: AccountRole,
    contextRef: ContextRef,
    _req?: PayloadRequest,
  ): Promise<boolean> {
    // Admin always has access
    if (userRole === AccountRole.Admin) {
      return true
    }

    // TODO: Implement actual enrollment check
    // For now, return true (all authenticated users can access)
    // Replace with real logic when enrollment system is implemented
    //
    // Example implementation:
    // const { relationTo, value: contextId } = contextRef
    // switch (relationTo) {
    //   case 'exercises':
    //     const exercise = await this.payload.findByID({
    //       collection: 'exercises',
    //       id: contextId,
    //     })
    //     return this.isEnrolledInCourse(userId, exercise.lesson)
    //   case 'lessons':
    //     const lesson = await this.payload.findByID({
    //       collection: 'lessons',
    //       id: contextId,
    //     })
    //     return this.isEnrolledInCourse(userId, lesson.chapter)
    //   case 'chapters':
    //     const chapter = await this.payload.findByID({
    //       collection: 'chapters',
    //       id: contextId,
    //     })
    //     return this.isEnrolledInCourse(userId, chapter.course)
    //   case 'courses':
    //     return this.isEnrolledInCourse(userId, contextId)
    //   default:
    //     return false
    // }

    logger.debug({ userId, contextRef }, 'Context access granted (open access mode)')
    return true
  }

  /**
   * Validate guest session has access to context
   * Guests have open access to all content (similar to authenticated users)
   */
  async validateGuestContextAccess(
    guestSessionId: string,
    contextRef: ContextRef,
    _req?: PayloadRequest,
  ): Promise<boolean> {
    // Guests have open access to all content (tracked by session)
    logger.debug({ guestSessionId, contextRef }, 'Guest context access granted')
    return true
  }

  /**
   * Get conversation history with summary
   */
  async getConversationHistory(
    conversationId: string,
    req?: PayloadRequest,
  ): Promise<{ messages: ChatMessage[]; summary?: string }> {
    const conversation = await this.payload.findByID({
      collection: 'conversations',
      id: conversationId,
      ...(req && { req }),
    })

    return {
      messages: (conversation.messages as ChatMessage[]) || [],
      summary: conversation.summary ?? undefined,
    }
  }

  /**
   * Get active conversation by context key
   */
  async getActiveConversation(
    userId: string,
    contextKey: string,
    req?: PayloadRequest,
  ): Promise<ConversationWithHistory | null> {
    const result = await this.payload.find({
      collection: 'conversations',
      where: {
        and: [
          { user: { equals: userId } },
          { contextKey: { equals: contextKey } },
          { archivedAt: { exists: false } },
        ],
      },
      limit: 1,
      ...(req && { req }),
    })

    if (result.docs.length === 0) {
      return null
    }

    return result.docs[0] as unknown as ConversationWithHistory
  }

  /**
   * Get or create active conversation for a GUEST session
   * Similar to user version but uses guestSession instead of user
   */
  async getOrCreateGuestConversation(
    guestSessionId: string,
    contextRef: ContextRef,
    req?: PayloadRequest,
  ): Promise<ConversationWithHistory> {
    // Verify guest session status before creating conversation
    const sessionDoc = await this.payload.findByID({
      collection: 'guest-sessions',
      id: guestSessionId,
      depth: 0,
    })
    if (!sessionDoc || sessionDoc.status !== 'active') {
      throw new GuestSessionClaimingError()
    }

    const contextKey = `${contextRef.relationTo}:${contextRef.value}`

    const existingConv = await this.payload.find({
      collection: 'conversations',
      where: {
        and: [
          { guestSession: { equals: guestSessionId } },
          { contextKey: { equals: contextKey } },
          { archivedAt: { exists: false } },
        ],
      },
      limit: 1,
      ...(req && { req }),
    })

    if (existingConv.docs.length > 0) {
      logger.info(
        { guestSessionId, contextKey, conversationId: existingConv.docs[0].id },
        'Found existing active guest conversation',
      )
      return existingConv.docs[0] as unknown as ConversationWithHistory
    }

    // Check conversation limit before creating new one
    const countResult = await this.payload.find({
      collection: 'conversations',
      where: {
        and: [{ guestSession: { equals: guestSessionId } }, { archivedAt: { exists: false } }],
      },
      limit: 0,
      ...(req && { req }),
    })

    const guestConfig = await getGuestChatConfig()
    if (countResult.totalDocs >= guestConfig.max_conversations) {
      throw new GuestConversationLimitError(guestConfig.max_conversations)
    }

    const newConv = await this.payload.create({
      collection: 'conversations',
      data: {
        guestSession: guestSessionId,
        contextRef: {
          relationTo: contextRef.relationTo,
          value: contextRef.value,
        },
        contextKey,
        messages: [],
        lastMessageAt: new Date(),
        contextPolicyVersion: 'v1',
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      draft: false,
      ...(req && { req }),
    })

    logger.info(
      { guestSessionId, contextKey, conversationId: newConv.id },
      'Created new guest conversation',
    )
    return newConv as unknown as ConversationWithHistory
  }

  /**
   * Get guest conversation by context key
   */
  async getGuestConversation(
    guestSessionId: string,
    contextKey: string,
    req?: PayloadRequest,
  ): Promise<ConversationWithHistory | null> {
    const result = await this.payload.find({
      collection: 'conversations',
      where: {
        and: [
          { guestSession: { equals: guestSessionId } },
          { contextKey: { equals: contextKey } },
          { archivedAt: { exists: false } },
        ],
      },
      limit: 1,
      ...(req && { req }),
    })

    if (result.docs.length === 0) return null
    return result.docs[0] as unknown as ConversationWithHistory
  }

  /**
   * Reset guest conversation (archive + create new)
   */
  async resetGuestConversation(
    guestSessionId: string,
    contextKey: string,
    req?: PayloadRequest,
  ): Promise<ConversationWithHistory> {
    const existingConv = await this.payload.find({
      collection: 'conversations',
      where: {
        and: [
          { guestSession: { equals: guestSessionId } },
          { contextKey: { equals: contextKey } },
          { archivedAt: { exists: false } },
        ],
      },
      limit: 1,
      ...(req && { req }),
    })

    if (existingConv.docs.length > 0) {
      const currentConv = existingConv.docs[0]
      await this.payload.update({
        collection: 'conversations',
        id: currentConv.id,
        data: {
          archivedAt: new Date(),
        } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        overrideAccess: true,
        context: { allowArchive: true },
        ...(req && { req }),
      })
      logger.info(
        { guestSessionId, contextKey, conversationId: currentConv.id },
        'Archived guest conversation',
      )
    }

    const [relationTo, value] = contextKey.split(':') as [ContextRef['relationTo'], string]
    const newConv = await this.payload.create({
      collection: 'conversations',
      data: {
        guestSession: guestSessionId,
        contextRef: { relationTo, value },
        contextKey,
        messages: [],
        lastMessageAt: new Date(),
        contextPolicyVersion: 'v1',
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      draft: false,
      ...(req && { req }),
    })

    logger.info(
      { guestSessionId, contextKey, conversationId: newConv.id },
      'Created new guest conversation after reset',
    )
    return newConv as unknown as ConversationWithHistory
  }
}

/**
 * Build context hierarchy keys by traversing parent relationships
 * Used for memory retrieval to get memories from parent contexts
 */
export async function buildContextHierarchy(
  contextKey: string,
  payload: Payload,
  req?: PayloadRequest,
): Promise<string[]> {
  const [collection, id] = contextKey.split(':')
  const keys: string[] = [contextKey]

  // Traverse parents based on collection type
  if (collection === 'exercises') {
    const exercise = await payload.findByID({
      collection: 'exercises',
      id,
      depth: 0,
      ...(req && { req }),
    })
    const lessonKey = `lessons:${exercise.lesson}`
    keys.push(lessonKey)

    const lesson = await payload.findByID({
      collection: 'lessons',
      id: exercise.lesson as string,
      depth: 0,
      ...(req && { req }),
    })
    const chapterKey = `chapters:${lesson.chapter}`
    keys.push(chapterKey)

    const chapter = await payload.findByID({
      collection: 'chapters',
      id: lesson.chapter as string,
      depth: 0,
      ...(req && { req }),
    })
    const courseKey = `courses:${chapter.course}`
    keys.push(courseKey)
  } else if (collection === 'lessons') {
    const lesson = await payload.findByID({
      collection: 'lessons',
      id,
      depth: 0,
      ...(req && { req }),
    })
    keys.push(`chapters:${lesson.chapter}`)

    const chapter = await payload.findByID({
      collection: 'chapters',
      id: lesson.chapter as string,
      depth: 0,
      ...(req && { req }),
    })
    keys.push(`courses:${chapter.course}`)
  } else if (collection === 'chapters') {
    const chapter = await payload.findByID({
      collection: 'chapters',
      id,
      depth: 0,
      ...(req && { req }),
    })
    keys.push(`courses:${chapter.course}`)
  } else if (collection === 'categories') {
    // Categories have no parent - they are top-level organizational units
    // No additional keys to add
  }
  // 'courses' and 'categories' collections have no parent

  keys.push('global') // Always include user-global context
  return keys
}

/**
 * Derive context level from relationTo
 * Handles unknown/invalid values by returning 'global'
 */
export function deriveContextLevel(
  relationTo: string,
): 'exercise' | 'lesson' | 'chapter' | 'course' | 'category' | 'global' {
  const mapping: Record<
    string,
    'exercise' | 'lesson' | 'chapter' | 'course' | 'category' | 'global'
  > = {
    exercises: 'exercise',
    lessons: 'lesson',
    chapters: 'chapter',
    courses: 'course',
    categories: 'category',
    users: 'global',
  }
  return mapping[relationTo] ?? 'global'
}
