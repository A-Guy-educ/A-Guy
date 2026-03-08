import { queryLessonBySlug } from '@/server/repos/queries/lessons'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

// Mock Payload
vi.mock('payload', () => ({
  getPayload: vi.fn(),
}))

vi.mock('@payload-config', () => ({
  default: {},
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
})
