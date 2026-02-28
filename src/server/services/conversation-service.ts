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
import type { Payload, PayloadRequest } from 'payload'

export class GuestConversationLimitError extends Error {
  constructor(limit: number) {
    super(
      `Guest session has reached the maximum of ${limit} conversations. Please sign up to continue.`,
    )
    this.name = 'GuestConversationLimitError'
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

    if (existingConv.docs.length > 0) {
      const currentConv = existingConv.docs[0]
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
   * Access rules:
   * - Admin users have full access
   * - Non-admin users must have an active enrollment in the course
   * - Context hierarchy is traversed to find the root course
   */
  async validateContextAccess(
    userId: string,
    userRole: AccountRole,
    contextRef: ContextRef,
    req?: PayloadRequest,
  ): Promise<boolean> {
    // Admin always has access
    if (userRole === AccountRole.Admin) {
      return true
    }

    // Traverse context hierarchy to find the course
    const courseId = await this.findCourseIdFromContext(contextRef, req)

    if (!courseId) {
      // Cannot determine course - deny access
      logger.warn({ userId, contextRef }, 'Could not determine course from context')
      return false
    }

    // Check if user is enrolled in the course
    const isEnrolled = await this.isEnrolledInCourse(userId, courseId, req)

    if (!isEnrolled) {
      logger.info({ userId, courseId, contextRef }, 'Access denied: user not enrolled in course')
      return false
    }

    logger.debug({ userId, courseId, contextRef }, 'Context access granted via enrollment')
    return true
  }

  /**
   * Check if a user is enrolled in a course with active status
   * Uses select to limit returned fields (security best practice)
   */
  private async isEnrolledInCourse(
    userId: string,
    courseId: string,
    req?: PayloadRequest,
  ): Promise<boolean> {
    const result = await this.payload.find({
      collection: 'enrollments',
      where: {
        and: [
          { user: { equals: userId } },
          { course: { equals: courseId } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 1,
      select: {
        id: true,
        accessType: true,
      },
      ...(req && { req }),
      overrideAccess: false, // Enforce access control
    })

    return result.docs.length > 0
  }

  /**
   * Traverse context hierarchy to find the root course ID
   * Returns null if course cannot be determined
   */
  private async findCourseIdFromContext(
    contextRef: ContextRef,
    req?: PayloadRequest,
  ): Promise<string | null> {
    const { relationTo, value: contextId } = contextRef

    switch (relationTo) {
      case 'exercises': {
        // Exercise -> Lesson -> Chapter -> Course
        const exercise = await this.payload.findByID({
          collection: 'exercises',
          id: contextId,
          depth: 0,
          ...(req && { req }),
        })
        const lessonId =
          typeof exercise.lesson === 'string'
            ? exercise.lesson
            : (exercise.lesson as { id?: string })?.id

        if (!lessonId) return null

        const lesson = await this.payload.findByID({
          collection: 'lessons',
          id: lessonId,
          depth: 0,
          ...(req && { req }),
        })
        const chapterId =
          typeof lesson.chapter === 'string'
            ? lesson.chapter
            : (lesson.chapter as { id?: string })?.id

        if (!chapterId) return null

        const chapter = await this.payload.findByID({
          collection: 'chapters',
          id: chapterId,
          depth: 0,
          ...(req && { req }),
        })
        const courseId =
          typeof chapter.course === 'string'
            ? chapter.course
            : (chapter.course as { id?: string })?.id

        return courseId || null
      }

      case 'lessons': {
        // Lesson -> Chapter -> Course
        const lesson = await this.payload.findByID({
          collection: 'lessons',
          id: contextId,
          depth: 0,
          ...(req && { req }),
        })
        const chapterId =
          typeof lesson.chapter === 'string'
            ? lesson.chapter
            : (lesson.chapter as { id?: string })?.id

        if (!chapterId) return null

        const chapter = await this.payload.findByID({
          collection: 'chapters',
          id: chapterId,
          depth: 0,
          ...(req && { req }),
        })
        const courseId =
          typeof chapter.course === 'string'
            ? chapter.course
            : (chapter.course as { id?: string })?.id

        return courseId || null
      }

      case 'chapters': {
        // Chapter -> Course
        const chapter = await this.payload.findByID({
          collection: 'chapters',
          id: contextId,
          depth: 0,
          ...(req && { req }),
        })
        const courseId =
          typeof chapter.course === 'string'
            ? chapter.course
            : (chapter.course as { id?: string })?.id

        return courseId || null
      }

      case 'courses': {
        // Direct course context
        return contextId
      }

      case 'categories':
      case 'users':
      default:
        // Categories and users don't have course hierarchy
        // For now, deny access - can be extended later
        return null
    }
  }

  /**
   * Validate guest session has access to context
   * Guests can only access free content
   */
  async validateGuestContextAccess(
    guestSessionId: string,
    contextRef: ContextRef,
    req?: PayloadRequest,
  ): Promise<boolean> {
    // Traverse context hierarchy to find the course
    const courseId = await this.findCourseIdFromContext(contextRef, req)

    if (!courseId) {
      // Cannot determine course - deny access
      logger.warn(
        { guestSessionId, contextRef },
        'Could not determine course from context for guest',
      )
      return false
    }

    // Check if course has free content
    // First check for any active enrollment (for future upgrade path)
    // Then check course's default access settings
    const isFree = await this.isCourseFreeContent(courseId, req)

    if (!isFree) {
      logger.info(
        { guestSessionId, courseId, contextRef },
        'Guest access denied: content is not free',
      )
      return false
    }

    logger.debug(
      { guestSessionId, courseId, contextRef },
      'Guest context access granted for free content',
    )
    return true
  }

  /**
   * Check if a course has free content access
   * Looks for any enrollment with accessType='free' for this course
   * (for future guest upgrade path) or checks course default access
   */
  private async isCourseFreeContent(courseId: string, req?: PayloadRequest): Promise<boolean> {
    // Check for free enrollment (future: when guest upgrades to registered user)
    const enrollmentResult = await this.payload.find({
      collection: 'enrollments',
      where: {
        and: [
          { course: { equals: courseId } },
          { accessType: { equals: 'free' } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 1,
      select: {
        id: true,
        accessType: true,
      },
      ...(req && { req }),
      overrideAccess: false,
    })

    if (enrollmentResult.docs.length > 0) {
      return true
    }

    // Fall back to checking course's default access settings
    const course = await this.payload.findByID({
      collection: 'courses',
      id: courseId,
      depth: 0,
      select: {
        accessType: true,
      },
      ...(req && { req }),
    })

    // Check if course has free access
    // Default to false (paid) if field doesn't exist
    const courseAccessType = (course as { accessType?: string }).accessType
    return courseAccessType === 'free'
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
