import { queryLessonBySlug, queryLessonsByCourse } from '@/server/repos/queries/lessons'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

// Mock Payload
vi.mock('payload', () => ({
  getPayload: vi.fn(),
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('@/server/repos/queries/chapters', () => ({
  queryChaptersByCourse: vi.fn(),
}))

type MockPayload = {
  findByID?: Mock
  find?: Mock
}

describe('Lesson Queries', () => {
  describe('queryLessonBySlug', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('returns lesson when found with valid chapter and course', async () => {
      const mockLesson = {
        id: 'lesson-1',
        title: 'Test Lesson',
        slug: 'test-lesson',
        chapter: { id: 'chapter-1', slug: 'test-chapter' },
      }

      const mockChapter = {
        id: 'chapter-1',
        title: 'Test Chapter',
        status: 'published',
        isActive: true,
        course: 'course-1',
      }

      const mockCourse = {
        id: 'course-1',
        title: 'Test Course',
        status: 'published',
        isActive: true,
      }

      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [mockLesson] }),
        findByID: vi
          .fn()
          .mockResolvedValueOnce(mockChapter) // chapter query
          .mockResolvedValueOnce(mockCourse), // course query
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryLessonBySlug({ slug: 'test-lesson' })

      expect(result).toEqual(mockLesson)
      expect(mockPayload.find).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'lessons',
          where: expect.objectContaining({
            and: expect.arrayContaining([
              expect.objectContaining({ slug: { equals: 'test-lesson' } }),
              expect.objectContaining({ status: { equals: 'published' } }),
              expect.objectContaining({ isActive: { equals: true } }),
            ]),
          }),
        }),
      )
    })

    it('returns null when no lesson found with slug', async () => {
      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryLessonBySlug({ slug: 'non-existent' })

      expect(result).toBeNull()
    })

    it('returns null when lesson has no chapter', async () => {
      const mockLesson = {
        id: 'lesson-1',
        title: 'Test Lesson',
        slug: 'test-lesson',
        chapter: null,
      }

      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [mockLesson] }),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryLessonBySlug({ slug: 'test-lesson' })

      expect(result).toBeNull()
    })

    it('returns null when chapter is not published', async () => {
      const mockLesson = {
        id: 'lesson-1',
        title: 'Test Lesson',
        slug: 'test-lesson',
        chapter: { id: 'chapter-1', slug: 'test-chapter' },
      }

      const mockChapter = {
        id: 'chapter-1',
        title: 'Test Chapter',
        status: 'draft', // Not published!
        isActive: true,
        course: 'course-1',
      }

      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [mockLesson] }),
        findByID: vi.fn().mockResolvedValue(mockChapter),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryLessonBySlug({ slug: 'test-lesson' })

      expect(result).toBeNull()
    })

    it('returns null when chapter is not active', async () => {
      const mockLesson = {
        id: 'lesson-1',
        title: 'Test Lesson',
        slug: 'test-lesson',
        chapter: { id: 'chapter-1', slug: 'test-chapter' },
      }

      const mockChapter = {
        id: 'chapter-1',
        title: 'Test Chapter',
        status: 'published',
        isActive: false, // Not active!
        course: 'course-1',
      }

      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [mockLesson] }),
        findByID: vi.fn().mockResolvedValue(mockChapter),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryLessonBySlug({ slug: 'test-lesson' })

      expect(result).toBeNull()
    })

    it('returns null when course is not published', async () => {
      const mockLesson = {
        id: 'lesson-1',
        title: 'Test Lesson',
        slug: 'test-lesson',
        chapter: { id: 'chapter-1', slug: 'test-chapter' },
      }

      const mockChapter = {
        id: 'chapter-1',
        title: 'Test Chapter',
        status: 'published',
        isActive: true,
        course: 'course-1',
      }

      const mockCourse = {
        id: 'course-1',
        title: 'Test Course',
        status: 'draft', // Not published!
        isActive: true,
      }

      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [mockLesson] }),
        findByID: vi
          .fn()
          .mockResolvedValueOnce(mockChapter) // chapter query
          .mockResolvedValueOnce(mockCourse), // course query
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryLessonBySlug({ slug: 'test-lesson' })

      expect(result).toBeNull()
    })

    it('returns null when course is not active', async () => {
      const mockLesson = {
        id: 'lesson-1',
        title: 'Test Lesson',
        slug: 'test-lesson',
        chapter: { id: 'chapter-1', slug: 'test-chapter' },
      }

      const mockChapter = {
        id: 'chapter-1',
        title: 'Test Chapter',
        status: 'published',
        isActive: true,
        course: 'course-1',
      }

      const mockCourse = {
        id: 'course-1',
        title: 'Test Course',
        status: 'published',
        isActive: false, // Not active!
      }

      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [mockLesson] }),
        findByID: vi
          .fn()
          .mockResolvedValueOnce(mockChapter) // chapter query
          .mockResolvedValueOnce(mockCourse), // course query
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryLessonBySlug({ slug: 'test-lesson' })

      expect(result).toBeNull()
    })

    it('handles string chapter ID (depth: 0 scenario)', async () => {
      const mockLesson = {
        id: 'lesson-1',
        title: 'Test Lesson',
        slug: 'test-lesson',
        chapter: 'chapter-1', // String ID, not object
      }

      const mockChapter = {
        id: 'chapter-1',
        title: 'Test Chapter',
        status: 'published',
        isActive: true,
        course: 'course-1',
      }

      const mockCourse = {
        id: 'course-1',
        title: 'Test Course',
        status: 'published',
        isActive: true,
      }

      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [mockLesson] }),
        findByID: vi
          .fn()
          .mockResolvedValueOnce(mockChapter) // chapter query
          .mockResolvedValueOnce(mockCourse), // course query
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryLessonBySlug({ slug: 'test-lesson' })

      expect(result).toEqual(mockLesson)
    })

    it('handles string course in chapter (depth: 0 scenario)', async () => {
      const mockLesson = {
        id: 'lesson-1',
        title: 'Test Lesson',
        slug: 'test-lesson',
        chapter: { id: 'chapter-1', slug: 'test-chapter' },
      }

      const mockChapter = {
        id: 'chapter-1',
        title: 'Test Chapter',
        status: 'published',
        isActive: true,
        course: 'course-1', // String ID
      }

      const mockCourse = {
        id: 'course-1',
        title: 'Test Course',
        status: 'published',
        isActive: true,
      }

      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [mockLesson] }),
        findByID: vi
          .fn()
          .mockResolvedValueOnce(mockChapter) // chapter query
          .mockResolvedValueOnce(mockCourse), // course query
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryLessonBySlug({ slug: 'test-lesson' })

      expect(result).toEqual(mockLesson)
    })
  })

  describe('queryLessonsByCourse', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    /**
     * BUG REPRODUCTION TEST:
     * Lessons from different chapters were interleaved when sorted globally by order.
     * Example: Ch1-L1(order=1), Ch2-L1(order=1), Ch1-L2(order=2), Ch2-L2(order=2)
     * Expected: Lessons should be grouped by chapter, then sorted by lesson order within each chapter.
     *   Ch1-L1(order=1), Ch1-L2(order=2), Ch2-L1(order=1), Ch2-L2(order=2)
     */
    it('returns lessons sorted by chapter order first, then by lesson order', async () => {
      const { getPayload } = await import('payload')
      const { queryChaptersByCourse } = await import('@/server/repos/queries/chapters')

      // Mock chapters sorted by their own order
      const mockChapters = [
        { id: 'chapter-1', title: 'Chapter 1', order: 0, status: 'published', isActive: true },
        { id: 'chapter-2', title: 'Chapter 2', order: 1, status: 'published', isActive: true },
      ]
      ;(queryChaptersByCourse as Mock).mockResolvedValue(mockChapters)

      // Mock lessons returned in arbitrary order (simulating flat sort by order only)
      // These have overlapping order values across chapters
      const mockLessonsInWrongOrder = [
        // Chapter 2 lessons come first (wrong!)
        { id: 'lesson-3', title: 'Lesson 3', chapter: { id: 'chapter-2' }, order: 0 },
        { id: 'lesson-4', title: 'Lesson 4', chapter: { id: 'chapter-2' }, order: 1 },
        // Chapter 1 lessons
        { id: 'lesson-1', title: 'Lesson 1', chapter: { id: 'chapter-1' }, order: 0 },
        { id: 'lesson-2', title: 'Lesson 2', chapter: { id: 'chapter-1' }, order: 1 },
      ]

      const mockCourse = {
        id: 'course-1',
        status: 'published',
        isActive: true,
      }

      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: mockLessonsInWrongOrder }),
        findByID: vi.fn().mockResolvedValue(mockCourse),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryLessonsByCourse({ courseId: 'course-1' })

      // Verify sorting: chapter-1 lessons first (chapter order 0), then chapter-2 lessons
      // Within each chapter, sorted by lesson order
      expect(result).toHaveLength(4)
      expect(result[0].id).toBe('lesson-1') // Chapter 1, order 0
      expect(result[1].id).toBe('lesson-2') // Chapter 1, order 1
      expect(result[2].id).toBe('lesson-3') // Chapter 2, order 0
      expect(result[3].id).toBe('lesson-4') // Chapter 2, order 1
    })

    it('handles lessons with undefined order values', async () => {
      const { getPayload } = await import('payload')
      const { queryChaptersByCourse } = await import('@/server/repos/queries/chapters')

      const mockChapters = [
        { id: 'chapter-1', title: 'Chapter 1', order: 0, status: 'published', isActive: true },
      ]
      ;(queryChaptersByCourse as Mock).mockResolvedValue(mockChapters)

      const mockLessons = [
        { id: 'lesson-2', title: 'Lesson 2', chapter: { id: 'chapter-1' }, order: undefined },
        { id: 'lesson-1', title: 'Lesson 1', chapter: { id: 'chapter-1' }, order: 0 },
      ]

      const mockCourse = {
        id: 'course-1',
        status: 'published',
        isActive: true,
      }

      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: mockLessons }),
        findByID: vi.fn().mockResolvedValue(mockCourse),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryLessonsByCourse({ courseId: 'course-1' })

      // Lessons with defined order should come first
      expect(result[0].id).toBe('lesson-1')
    })

    it('handles string chapter IDs', async () => {
      const { getPayload } = await import('payload')
      const { queryChaptersByCourse } = await import('@/server/repos/queries/chapters')

      const mockChapters = [
        { id: 'chapter-1', title: 'Chapter 1', order: 0, status: 'published', isActive: true },
        { id: 'chapter-2', title: 'Chapter 2', order: 1, status: 'published', isActive: true },
      ]
      ;(queryChaptersByCourse as Mock).mockResolvedValue(mockChapters)

      // Lessons with string chapter IDs (depth: 0)
      const mockLessons = [
        { id: 'lesson-3', title: 'Lesson 3', chapter: 'chapter-2', order: 0 },
        { id: 'lesson-1', title: 'Lesson 1', chapter: 'chapter-1', order: 0 },
        { id: 'lesson-2', title: 'Lesson 2', chapter: 'chapter-1', order: 1 },
        { id: 'lesson-4', title: 'Lesson 4', chapter: 'chapter-2', order: 1 },
      ]

      const mockCourse = {
        id: 'course-1',
        status: 'published',
        isActive: true,
      }

      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: mockLessons }),
        findByID: vi.fn().mockResolvedValue(mockCourse),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryLessonsByCourse({ courseId: 'course-1' })

      // Should sort correctly even with string chapter IDs
      expect(result[0].id).toBe('lesson-1') // Chapter 1, order 0
      expect(result[1].id).toBe('lesson-2') // Chapter 1, order 1
      expect(result[2].id).toBe('lesson-3') // Chapter 2, order 0
      expect(result[3].id).toBe('lesson-4') // Chapter 2, order 1
    })
  })
})
