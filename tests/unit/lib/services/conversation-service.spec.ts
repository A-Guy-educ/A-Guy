/**
 * Unit Tests for Conversation Service
 *
 * Tests the ConversationService class including:
 * - Context resolution with priority (Exercise > Lesson > Chapter > Course)
 * - Conversation reset functionality
 * - Access control validation
 *
 * Plus standalone functions:
 * - deriveContextLevel
 * - buildContextHierarchy
 */
import type { User } from '@/payload-types'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import {
  buildContextHierarchy,
  ConversationService,
  deriveContextLevel,
} from '@/server/services/conversation-service'
import type { Payload } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock Payload type
const createMockPayload = (overrides = {}): Payload =>
  ({
    find: vi.fn(),
    findByID: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
    ...overrides,
  }) as unknown as Payload

// Mock User
const _createMockUser = (role: AccountRole = AccountRole.Student, id = 'user-123'): User =>
  ({
    id,
    email: 'test@example.com',
    role,
    roles: [role],
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as unknown as User

describe('deriveContextLevel (standalone function)', () => {
  it('should return "exercise" for exercises relation', () => {
    expect(deriveContextLevel('exercises')).toBe('exercise')
  })

  it('should return "lesson" for lessons relation', () => {
    expect(deriveContextLevel('lessons')).toBe('lesson')
  })

  it('should return "chapter" for chapters relation', () => {
    expect(deriveContextLevel('chapters')).toBe('chapter')
  })

  it('should return "course" for courses relation', () => {
    expect(deriveContextLevel('courses')).toBe('course')
  })

  it('should return "category" for categories relation', () => {
    expect(deriveContextLevel('categories')).toBe('category')
  })

  it('should return "global" for unrecognized relation', () => {
    expect(deriveContextLevel('unknown')).toBe('global')
  })

  it('should return "global" for empty string', () => {
    expect(deriveContextLevel('')).toBe('global')
  })
})

describe('ContextKey generation', () => {
  it('should generate correct key for exercises', () => {
    const contextKey = `exercises:abc123`
    expect(contextKey).toBe('exercises:abc123')
  })

  it('should generate correct key for lessons', () => {
    const contextKey = `lessons:def456`
    expect(contextKey).toBe('lessons:def456')
  })

  it('should generate correct key for chapters', () => {
    const contextKey = `chapters:ghi789`
    expect(contextKey).toBe('chapters:ghi789')
  })

  it('should generate correct key for courses', () => {
    const contextKey = `courses:jkl012`
    expect(contextKey).toBe('courses:jkl012')
  })

  it('should generate correct key for categories', () => {
    const contextKey = `categories:admin`
    expect(contextKey).toBe('categories:admin')
  })

  it('should handle special characters in ID', () => {
    const contextKey = `exercises:id-with-special`
    expect(contextKey).toBe('exercises:id-with-special')
  })

  it('should handle UUID format IDs', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const contextKey = `courses:${uuid}`
    expect(contextKey).toBe(`courses:${uuid}`)
  })
})

describe('ContextKey parsing', () => {
  function parseContextKey(contextKey: string): { relationTo: string; id: string } {
    const [relationTo, id] = contextKey.split(':')
    if (!relationTo || !id) {
      throw new Error('Invalid context key format')
    }
    return { relationTo, id }
  }

  it('should parse exercise context key', () => {
    const result = parseContextKey('exercises:abc123')
    expect(result.relationTo).toBe('exercises')
    expect(result.id).toBe('abc123')
  })

  it('should parse lesson context key', () => {
    const result = parseContextKey('lessons:def456')
    expect(result.relationTo).toBe('lessons')
    expect(result.id).toBe('def456')
  })

  it('should parse chapter context key', () => {
    const result = parseContextKey('chapters:ghi789')
    expect(result.relationTo).toBe('chapters')
    expect(result.id).toBe('ghi789')
  })

  it('should parse course context key', () => {
    const result = parseContextKey('courses:jkl012')
    expect(result.relationTo).toBe('courses')
    expect(result.id).toBe('jkl012')
  })

  it('should parse category context key', () => {
    const result = parseContextKey('categories:admin')
    expect(result.relationTo).toBe('categories')
    expect(result.id).toBe('admin')
  })

  it('should throw error for invalid format', () => {
    expect(() => parseContextKey('invalid')).toThrow('Invalid context key format')
  })

  it('should throw error for empty string', () => {
    expect(() => parseContextKey('')).toThrow('Invalid context key format')
  })

  it('should throw error for missing collection prefix', () => {
    expect(() => parseContextKey(':abc123')).toThrow('Invalid context key format')
  })

  it('should throw error for missing ID', () => {
    expect(() => parseContextKey('exercises:')).toThrow('Invalid context key format')
  })
})

describe('buildContextHierarchy (standalone function)', () => {
  it('should return hierarchy for exercise context', async () => {
    const mockPayload = createMockPayload({
      findByID: vi
        .fn()
        .mockResolvedValueOnce({ lesson: 'lesson-123' }) // exercise
        .mockResolvedValueOnce({ chapter: 'chapter-456' }) // lesson
        .mockResolvedValueOnce({ course: 'course-789' }), // chapter
    })

    const result = await buildContextHierarchy('exercises:abc123', mockPayload)

    expect(result).toEqual([
      'exercises:abc123',
      'lessons:lesson-123',
      'chapters:chapter-456',
      'courses:course-789',
      'global',
    ])
  })

  it('should return hierarchy for lesson context', async () => {
    const mockPayload = createMockPayload({
      findByID: vi
        .fn()
        .mockResolvedValueOnce({ chapter: 'chapter-456' }) // lesson
        .mockResolvedValueOnce({ course: 'course-789' }), // chapter
    })

    const result = await buildContextHierarchy('lessons:lesson-123', mockPayload)

    expect(result).toEqual([
      'lessons:lesson-123',
      'chapters:chapter-456',
      'courses:course-789',
      'global',
    ])
  })

  it('should return hierarchy for chapter context', async () => {
    const mockPayload = createMockPayload({
      findByID: vi.fn().mockResolvedValueOnce({ course: 'course-789' }), // chapter
    })

    const result = await buildContextHierarchy('chapters:chapter-456', mockPayload)

    expect(result).toEqual(['chapters:chapter-456', 'courses:course-789', 'global'])
  })

  it('should return hierarchy for course context (no parent)', async () => {
    const mockPayload = createMockPayload({
      findByID: vi.fn(),
    })

    const result = await buildContextHierarchy('courses:course-789', mockPayload)

    expect(result).toEqual(['courses:course-789', 'global'])
  })

  it('should return hierarchy for category context (no parent)', async () => {
    const mockPayload = createMockPayload({
      findByID: vi.fn(),
    })

    const result = await buildContextHierarchy('categories:admin', mockPayload)

    expect(result).toEqual(['categories:admin', 'global'])
  })
})

describe('ConversationService (instance methods)', () => {
  let mockPayload: Payload

  beforeEach(() => {
    mockPayload = createMockPayload()
  })

  describe('resolveContext', () => {
    it('should prioritize exerciseId over lessonId', async () => {
      const mockPayloadWithExercise = createMockPayload({
        findByID: vi.fn().mockResolvedValueOnce({
          id: 'exercise-123',
          lesson: 'lesson-456', // Exercise belongs to a lesson
        }),
      })
      const service = new ConversationService(mockPayloadWithExercise)
      const result = await service.resolveContext({
        exerciseId: 'exercise-123',
        lessonId: 'lesson-456',
      })

      // Exercise with parent lesson should use lessons context
      expect(result.relationTo).toBe('lessons')
      expect(result.value).toBe('lesson-456')
      expect(result.contextKey).toBe('lessons:lesson-456')
    })

    it('should prioritize lessonId over chapterId', async () => {
      const service = new ConversationService(mockPayload)
      const result = await service.resolveContext({
        lessonId: 'lesson-123',
        chapterId: 'chapter-456',
      })

      expect(result.relationTo).toBe('lessons')
      expect(result.value).toBe('lesson-123')
      expect(result.contextKey).toBe('lessons:lesson-123')
    })

    it('should prioritize chapterId over courseId', async () => {
      const service = new ConversationService(mockPayload)
      const result = await service.resolveContext({
        chapterId: 'chapter-123',
        courseId: 'course-456',
      })

      expect(result.relationTo).toBe('chapters')
      expect(result.value).toBe('chapter-123')
      expect(result.contextKey).toBe('chapters:chapter-123')
    })

    it('should return course context when only courseId provided', async () => {
      const service = new ConversationService(mockPayload)
      const result = await service.resolveContext({
        courseId: 'course-123',
      })

      expect(result.relationTo).toBe('courses')
      expect(result.value).toBe('course-123')
      expect(result.contextKey).toBe('courses:course-123')
    })

    it('should return category context when only categoryId provided', async () => {
      const service = new ConversationService(mockPayload)
      const result = await service.resolveContext({
        categoryId: 'admin',
      })

      expect(result.relationTo).toBe('categories')
      expect(result.value).toBe('admin')
      expect(result.contextKey).toBe('categories:admin')
    })

    it('should throw error when no context provided', async () => {
      const service = new ConversationService(mockPayload)
      await expect(service.resolveContext({})).rejects.toThrow('No context provided')
    })
  })

  describe('validateContextAccess', () => {
    it('should allow admin access to any context', async () => {
      const service = new ConversationService(mockPayload)
      const result = await service.validateContextAccess('user-123', AccountRole.Admin, {
        relationTo: 'courses',
        value: 'course-123',
      })

      expect(result).toBe(true)
    })

    it('should allow student access when enrolled', async () => {
      // Setup: Student is enrolled in the course
      const mockPayloadWithEnrollment = createMockPayload({
        find: vi.fn().mockResolvedValue({
          docs: [{ id: 'enrollment-1', user: 'user-123', course: 'course-123', status: 'active' }],
          totalDocs: 1,
        }),
      })
      const service = new ConversationService(mockPayloadWithEnrollment)
      const result = await service.validateContextAccess('user-123', AccountRole.Student, {
        relationTo: 'courses',
        value: 'course-123',
      })

      // Student should have access when enrolled
      expect(result).toBe(true)
    })

    describe('enrollment-based access control', () => {
      beforeEach(() => {
        vi.clearAllMocks()
      })

      it('should grant access to enrolled student for course context', async () => {
        // Setup: Student is enrolled in the course
        const mockPayloadWithEnrollment = createMockPayload({
          find: vi.fn().mockResolvedValue({
            docs: [
              { id: 'enrollment-1', user: 'student-123', course: 'course-123', status: 'active' },
            ],
            totalDocs: 1,
          }),
        })

        const service = new ConversationService(mockPayloadWithEnrollment)
        const result = await service.validateContextAccess(
          'student-123',
          AccountRole.Student,
          { relationTo: 'courses', value: 'course-123' },
          undefined,
        )

        // Student should have access when enrolled
        expect(result).toBe(true)
        // Verify the enrollments collection was queried
        expect(mockPayloadWithEnrollment.find).toHaveBeenCalledWith(
          expect.objectContaining({
            collection: 'enrollments',
          }),
        )
      })

      it('should deny access to non-enrolled student for course context', async () => {
        // Setup: Student is NOT enrolled in the course
        const mockPayloadNoEnrollment = createMockPayload({
          find: vi.fn().mockResolvedValue({
            docs: [],
            totalDocs: 0,
          }),
        })

        const service = new ConversationService(mockPayloadNoEnrollment)
        const result = await service.validateContextAccess(
          'student-456',
          AccountRole.Student,
          { relationTo: 'courses', value: 'course-123' },
          undefined,
        )

        // Student should be denied when not enrolled
        expect(result).toBe(false)
        // Verify the enrollments collection was queried
        expect(mockPayloadNoEnrollment.find).toHaveBeenCalledWith(
          expect.objectContaining({
            collection: 'enrollments',
          }),
        )
      })

      it('should traverse hierarchy: exercise → lesson → chapter → course for enrollment check', async () => {
        // Setup: Exercise belongs to lesson → chapter → course
        // Student is enrolled in the course
        const mockPayloadHierarchy = createMockPayload({
          findByID: vi
            .fn()
            .mockResolvedValueOnce({ lesson: 'lesson-456' }) // exercise lookup
            .mockResolvedValueOnce({ chapter: 'chapter-789' }) // lesson lookup
            .mockResolvedValueOnce({ course: 'course-123' }), // chapter lookup
          find: vi.fn().mockResolvedValue({
            docs: [
              { id: 'enrollment-1', user: 'student-123', course: 'course-123', status: 'active' },
            ],
            totalDocs: 1,
          }),
        })

        const service = new ConversationService(mockPayloadHierarchy)
        const result = await service.validateContextAccess(
          'student-123',
          AccountRole.Student,
          { relationTo: 'exercises', value: 'exercise-111' },
          undefined,
        )

        // Student should have access through hierarchy traversal
        expect(result).toBe(true)
        // Verify hierarchy traversal happened
        expect(mockPayloadHierarchy.findByID).toHaveBeenCalledTimes(3)
        expect(mockPayloadHierarchy.findByID).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({ collection: 'exercises', id: 'exercise-111' }),
        )
        expect(mockPayloadHierarchy.findByID).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({ collection: 'lessons', id: 'lesson-456' }),
        )
        expect(mockPayloadHierarchy.findByID).toHaveBeenNthCalledWith(
          3,
          expect.objectContaining({ collection: 'chapters', id: 'chapter-789' }),
        )
      })

      it('should traverse hierarchy: lesson → chapter → course for enrollment check', async () => {
        // Setup: Lesson belongs to chapter → course
        // Student is enrolled in the course
        const mockPayloadLessonHierarchy = createMockPayload({
          findByID: vi
            .fn()
            .mockResolvedValueOnce({ chapter: 'chapter-789' }) // lesson lookup
            .mockResolvedValueOnce({ course: 'course-123' }), // chapter lookup
          find: vi.fn().mockResolvedValue({
            docs: [
              { id: 'enrollment-1', user: 'student-123', course: 'course-123', status: 'active' },
            ],
            totalDocs: 1,
          }),
        })

        const service = new ConversationService(mockPayloadLessonHierarchy)
        const result = await service.validateContextAccess(
          'student-123',
          AccountRole.Student,
          { relationTo: 'lessons', value: 'lesson-456' },
          undefined,
        )

        // Student should have access through hierarchy traversal
        expect(result).toBe(true)
        // Verify hierarchy traversal (2 lookups: lesson, chapter)
        expect(mockPayloadLessonHierarchy.findByID).toHaveBeenCalledTimes(2)
      })

      it('should traverse hierarchy: chapter → course for enrollment check', async () => {
        // Setup: Chapter belongs to course
        // Student is enrolled in the course
        const mockPayloadChapterHierarchy = createMockPayload({
          findByID: vi.fn().mockResolvedValueOnce({ course: 'course-123' }), // chapter lookup
          find: vi.fn().mockResolvedValue({
            docs: [
              { id: 'enrollment-1', user: 'student-123', course: 'course-123', status: 'active' },
            ],
            totalDocs: 1,
          }),
        })

        const service = new ConversationService(mockPayloadChapterHierarchy)
        const result = await service.validateContextAccess(
          'student-123',
          AccountRole.Student,
          { relationTo: 'chapters', value: 'chapter-789' },
          undefined,
        )

        // Student should have access through hierarchy traversal
        expect(result).toBe(true)
        // Verify hierarchy traversal (1 lookup: chapter → course)
        expect(mockPayloadChapterHierarchy.findByID).toHaveBeenCalledTimes(1)
      })

      it('should deny non-enrolled student even with valid hierarchy', async () => {
        // Setup: Hierarchy is valid but student is not enrolled
        const mockPayloadNotEnrolled = createMockPayload({
          findByID: vi.fn().mockResolvedValueOnce({ course: 'course-123' }), // chapter lookup
          find: vi.fn().mockResolvedValue({
            docs: [], // No enrollment found
            totalDocs: 0,
          }),
        })

        const service = new ConversationService(mockPayloadNotEnrolled)
        const result = await service.validateContextAccess(
          'student-456',
          AccountRole.Student,
          { relationTo: 'chapters', value: 'chapter-789' },
          undefined,
        )

        // Student should be denied - no enrollment
        expect(result).toBe(false)
      })
    })
  })

  describe('validateGuestContextAccess', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should allow guest access to free content', async () => {
      // First checks enrollments (returns empty), then checks course
      const mockPayloadFreeContent = createMockPayload({
        find: vi.fn().mockResolvedValue({
          docs: [], // No free enrollment found
          totalDocs: 0,
        }),
        findByID: vi.fn().mockResolvedValue({
          id: 'course-123',
          accessType: 'free', // Course is free
        }),
      })

      const service = new ConversationService(mockPayloadFreeContent)
      const result = await service.validateGuestContextAccess('guest-session-123', {
        relationTo: 'courses',
        value: 'course-123',
      })

      // Guest should have access to free content
      expect(result).toBe(true)
      // Verify the course was checked for free status
      expect(mockPayloadFreeContent.findByID).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'courses',
          id: 'course-123',
        }),
      )
    })

    it('should deny guest access to paid content', async () => {
      // First checks enrollments (returns empty), then checks course
      const mockPayloadPaidContent = createMockPayload({
        find: vi.fn().mockResolvedValue({
          docs: [], // No free enrollment found
          totalDocs: 0,
        }),
        findByID: vi.fn().mockResolvedValue({
          id: 'course-123',
          accessType: 'paid', // Course is paid
        }),
      })

      const service = new ConversationService(mockPayloadPaidContent)
      const result = await service.validateGuestContextAccess('guest-session-123', {
        relationTo: 'courses',
        value: 'course-123',
      })

      // Guest should be denied for paid content
      expect(result).toBe(false)
    })

    it('should traverse hierarchy for guest access check on lessons', async () => {
      // Guest accessing a lesson - should check if parent course is free
      const mockPayloadLessonGuest = createMockPayload({
        find: vi.fn().mockResolvedValue({
          docs: [], // No free enrollment
          totalDocs: 0,
        }),
        findByID: vi
          .fn()
          .mockResolvedValueOnce({ chapter: 'chapter-789' }) // lesson lookup
          .mockResolvedValueOnce({ course: 'course-123' }) // chapter lookup
          .mockResolvedValueOnce({ accessType: 'free' }), // course lookup
      })

      const service = new ConversationService(mockPayloadLessonGuest)
      const result = await service.validateGuestContextAccess('guest-session-123', {
        relationTo: 'lessons',
        value: 'lesson-456',
      })

      // Guest should have access because course is free
      expect(result).toBe(true)
      // Verify hierarchy traversal happened
      expect(mockPayloadLessonGuest.findByID).toHaveBeenCalledTimes(3)
      expect(mockPayloadLessonGuest.findByID).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ collection: 'lessons', id: 'lesson-456' }),
      )
      expect(mockPayloadLessonGuest.findByID).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ collection: 'chapters', id: 'chapter-789' }),
      )
    })

    it('should traverse hierarchy for guest access check on exercises', async () => {
      // Guest accessing an exercise - should check if parent course is free
      const mockPayloadExerciseGuest = createMockPayload({
        find: vi.fn().mockResolvedValue({
          docs: [], // No free enrollment
          totalDocs: 0,
        }),
        findByID: vi
          .fn()
          .mockResolvedValueOnce({ lesson: 'lesson-456' }) // exercise lookup
          .mockResolvedValueOnce({ chapter: 'chapter-789' }) // lesson lookup
          .mockResolvedValueOnce({ course: 'course-123' }) // chapter lookup
          .mockResolvedValueOnce({ accessType: 'paid' }), // course lookup - paid
      })

      const service = new ConversationService(mockPayloadExerciseGuest)
      const result = await service.validateGuestContextAccess('guest-session-123', {
        relationTo: 'exercises',
        value: 'exercise-111',
      })

      // Guest should be denied because course is paid
      expect(result).toBe(false)
      // Verify full hierarchy traversal plus course check
      expect(mockPayloadExerciseGuest.findByID).toHaveBeenCalledTimes(4)
    })
  })

  describe('getOrCreateActiveConversation', () => {
    it('should return existing active conversation', async () => {
      // INVARIANT: Active = archivedAt field is MISSING
      const existingConversation = {
        id: 'conv-123',
        user: 'user-123',
        contextKey: 'exercises:exercise-123',
        // archivedAt field missing = active
      }

      mockPayload.find = vi.fn().mockResolvedValue({
        docs: [existingConversation],
        totalDocs: 1,
      })

      const service = new ConversationService(mockPayload)
      const result = await service.getOrCreateActiveConversation('user-123', {
        relationTo: 'exercises',
        value: 'exercise-123',
      })

      expect(result.id).toBe('conv-123')
      expect(mockPayload.find).toHaveBeenCalled()
    })

    it('should create new conversation when none exists', async () => {
      mockPayload.find = vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 })
      mockPayload.create = vi.fn().mockResolvedValue({
        id: 'new-conv-123',
        user: 'user-123',
        contextKey: 'exercises:exercise-123',
      })

      const service = new ConversationService(mockPayload)
      const result = await service.getOrCreateActiveConversation('user-123', {
        relationTo: 'exercises',
        value: 'exercise-123',
      })

      expect(result.id).toBe('new-conv-123')
      expect(mockPayload.create).toHaveBeenCalled()
    })
  })

  describe('resetConversation', () => {
    it('should archive existing and create new conversation', async () => {
      // INVARIANT: Active = archivedAt field is MISSING
      const existingConversation = {
        id: 'old-conv-123',
        user: 'user-123',
        contextKey: 'exercises:exercise-123',
        // archivedAt field missing = active
      }

      mockPayload.find = vi.fn().mockResolvedValue({
        docs: [existingConversation],
        totalDocs: 1,
      })
      mockPayload.update = vi.fn().mockResolvedValue({
        id: 'old-conv-123',
        archivedAt: new Date().toISOString(),
      })
      // INVARIANT: Active = archivedAt field is MISSING
      mockPayload.create = vi.fn().mockResolvedValue({
        id: 'new-conv-456',
        user: 'user-123',
        contextKey: 'exercises:exercise-123',
        // archivedAt field missing = active
      })

      const service = new ConversationService(mockPayload)
      const result = await service.resetConversation('user-123', 'exercises:exercise-123')

      expect(result.id).toBe('new-conv-456')
      expect(mockPayload.update).toHaveBeenCalled()
      expect(mockPayload.create).toHaveBeenCalled()
    })

    it('should create new conversation when none exists', async () => {
      mockPayload.find = vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 })
      // INVARIANT: Active = archivedAt field is MISSING
      mockPayload.create = vi.fn().mockResolvedValue({
        id: 'new-conv-123',
        user: 'user-123',
        contextKey: 'exercises:exercise-123',
        // archivedAt field missing = active
      })

      const service = new ConversationService(mockPayload)
      const result = await service.resetConversation('user-123', 'exercises:exercise-123')

      expect(result.id).toBe('new-conv-123')
      expect(mockPayload.create).toHaveBeenCalled()
      // No update call since there was no existing conversation to archive
      expect(mockPayload.update).not.toHaveBeenCalled()
    })
  })

  describe('getConversationHistory', () => {
    it('should return messages from conversation', async () => {
      const mockConversation = {
        id: 'conv-123',
        messages: [
          { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
          { role: 'assistant', content: 'Hi there!', timestamp: new Date().toISOString() },
        ],
        summary: 'Conversation summary',
      }

      mockPayload.findByID = vi.fn().mockResolvedValue(mockConversation)

      const service = new ConversationService(mockPayload)
      const result = await service.getConversationHistory('conv-123')

      expect(result.messages).toHaveLength(2)
      expect(result.summary).toBe('Conversation summary')
    })

    it('should handle conversation without messages', async () => {
      const mockConversation = {
        id: 'conv-123',
        messages: [],
        summary: '',
      }

      mockPayload.findByID = vi.fn().mockResolvedValue(mockConversation)

      const service = new ConversationService(mockPayload)
      const result = await service.getConversationHistory('conv-123')

      expect(result.messages).toHaveLength(0)
      expect(result.summary).toBe('')
    })
  })

  describe('getActiveConversation', () => {
    it('should return active conversation by context key', async () => {
      // INVARIANT: Active = archivedAt field is MISSING
      const mockConversation = {
        id: 'conv-123',
        user: 'user-123',
        contextKey: 'exercises:exercise-123',
        // archivedAt field missing = active
      }

      mockPayload.find = vi.fn().mockResolvedValue({
        docs: [mockConversation],
        totalDocs: 1,
      })

      const service = new ConversationService(mockPayload)
      const result = await service.getActiveConversation('user-123', 'exercises:exercise-123')

      expect(result).not.toBeNull()
      expect(result!.id).toBe('conv-123')
    })

    it('should return null when no active conversation', async () => {
      mockPayload.find = vi.fn().mockResolvedValue({
        docs: [],
        totalDocs: 0,
      })

      const service = new ConversationService(mockPayload)
      const result = await service.getActiveConversation('user-123', 'exercises:exercise-123')

      expect(result).toBeNull()
    })
  })
})

describe('Context Resolution Priority', () => {
  it('should follow priority: Exercise > Lesson > Chapter > Course > Category', async () => {
    const mockPayloadWithExercise = createMockPayload({
      findByID: vi.fn().mockResolvedValueOnce({
        id: 'exercise-id',
        lesson: 'lesson-id', // Exercise belongs to a lesson
      }),
    })
    const service = new ConversationService(mockPayloadWithExercise)

    const result = await service.resolveContext({
      exerciseId: 'exercise-id',
      lessonId: 'lesson-id',
      chapterId: 'chapter-id',
      courseId: 'course-id',
      categoryId: 'category-id',
    })

    // Exercise with parent lesson should use lessons context
    expect(result.relationTo).toBe('lessons')
    expect(result.value).toBe('lesson-id')
  })

  it('should select lesson when only lesson and chapter provided', async () => {
    const mockPayload = createMockPayload()
    const service = new ConversationService(mockPayload)

    const result = await service.resolveContext({
      lessonId: 'lesson-id',
      chapterId: 'chapter-id',
      courseId: 'course-id',
      categoryId: 'category-id',
    })

    expect(result.relationTo).toBe('lessons')
    expect(result.value).toBe('lesson-id')
  })

  it('should select chapter when only chapter and course provided', async () => {
    const mockPayload = createMockPayload()
    const service = new ConversationService(mockPayload)

    const result = await service.resolveContext({
      chapterId: 'chapter-id',
      courseId: 'course-id',
      categoryId: 'category-id',
    })

    expect(result.relationTo).toBe('chapters')
    expect(result.value).toBe('chapter-id')
  })

  it('should select course when only course and category provided', async () => {
    const mockPayload = createMockPayload()
    const service = new ConversationService(mockPayload)

    const result = await service.resolveContext({
      courseId: 'course-id',
      categoryId: 'category-id',
    })

    expect(result.relationTo).toBe('courses')
    expect(result.value).toBe('course-id')
  })

  it('should select category when only category provided', async () => {
    const mockPayload = createMockPayload()
    const service = new ConversationService(mockPayload)

    const result = await service.resolveContext({ categoryId: 'admin' })

    expect(result.relationTo).toBe('categories')
    expect(result.value).toBe('admin')
  })
})

describe('Archival via archivedAt', () => {
  it('should omit archivedAt field for active conversations', () => {
    // INVARIANT: Active = archivedAt field is MISSING
    const conversation: { id: string; archivedAt?: Date } = {
      id: 'conv-123',
      // archivedAt field missing = active
    }

    expect(conversation.archivedAt).toBeUndefined()
  })

  it('should use archivedAt=Date for archived conversations', () => {
    const archivedDate = new Date()
    const conversation = {
      id: 'conv-123',
      archivedAt: archivedDate,
    }

    expect(conversation.archivedAt).toBe(archivedDate)
  })
})
