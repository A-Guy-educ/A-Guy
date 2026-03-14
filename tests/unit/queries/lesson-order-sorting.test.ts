/**
 * @fileType unit-test
 * @domain courses, lessons
 * @pattern lesson-order-sorting
 * @ai-summary Test that queryLessonsByCourse returns lessons sorted by chapter order first, then lesson order within each chapter
 */
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { queryLessonsByCourse } from '@/server/repos/queries/lessons'

// Mock Payload
vi.mock('payload', () => ({
  getPayload: vi.fn(),
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

// Mock the chapters query since queryLessonsByCourse calls it internally
vi.mock('@/server/repos/queries/chapters', () => ({
  queryChaptersByCourse: vi.fn(),
}))

type MockPayload = {
  findByID?: Mock
  find?: Mock
}

describe('Lesson Queries - queryLessonsByCourse sorting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return lessons sorted by chapter order first, then lesson order within each chapter', async () => {
    // Setup: Course with two chapters (chapter 1 order=0, chapter 2 order=1)
    // Chapter 1 has lessons with order 1, 2, 3
    // Chapter 2 has lessons with order 1, 2, 3
    // Expected: Chapter 1 lessons first (in order 1,2,3), then Chapter 2 lessons (in order 1,2,3)

    const mockChapters = [
      {
        id: 'chapter-1',
        title: 'Chapter 1',
        slug: 'chapter-1',
        order: 0, // First chapter
        course: 'course-1',
        status: 'published',
        isActive: true,
      },
      {
        id: 'chapter-2',
        title: 'Chapter 2',
        slug: 'chapter-2',
        order: 1, // Second chapter
        course: 'course-1',
        status: 'published',
        isActive: true,
      },
    ]

    // Mock lessons returned in a flat order by the database query
    // The DB query sorts by lesson.order only, so lessons from both chapters get interleaved
    // This is the BUG: DB returns [ch1-1, ch2-1, ch1-2, ch2-2, ch1-3, ch2-3]
    const mockLessons = [
      {
        id: 'lesson-ch1-1',
        title: 'Lesson 1 Ch1',
        chapter: { id: 'chapter-1', slug: 'chapter-1' },
        order: 1,
      },
      {
        id: 'lesson-ch2-1',
        title: 'Lesson 1 Ch2',
        chapter: { id: 'chapter-2', slug: 'chapter-2' },
        order: 1,
      },
      {
        id: 'lesson-ch1-2',
        title: 'Lesson 2 Ch1',
        chapter: { id: 'chapter-1', slug: 'chapter-1' },
        order: 2,
      },
      {
        id: 'lesson-ch2-2',
        title: 'Lesson 2 Ch2',
        chapter: { id: 'chapter-2', slug: 'chapter-2' },
        order: 2,
      },
      {
        id: 'lesson-ch1-3',
        title: 'Lesson 3 Ch1',
        chapter: { id: 'chapter-1', slug: 'chapter-1' },
        order: 3,
      },
      {
        id: 'lesson-ch2-3',
        title: 'Lesson 3 Ch2',
        chapter: { id: 'chapter-2', slug: 'chapter-2' },
        order: 3,
      },
    ]

    const mockCourse = {
      id: 'course-1',
      status: 'published',
      isActive: true,
    }

    const { getPayload } = await import('payload')
    const mockPayload: MockPayload = {
      findByID: vi.fn().mockResolvedValue(mockCourse),
      find: vi.fn().mockResolvedValue({ docs: mockLessons }),
    }
    ;(getPayload as Mock).mockResolvedValue(mockPayload)

    // Import the mocked chapters function
    const { queryChaptersByCourse } = await import('@/server/repos/queries/chapters')
    ;(queryChaptersByCourse as Mock).mockResolvedValue(mockChapters)

    // Execute
    const result = await queryLessonsByCourse({ courseId: 'course-1' })

    // Get the sequence of lesson IDs in the result
    const resultLessonIds = result.map((lesson) => lesson.id)

    // EXPECTED: Lessons should be grouped by chapter order first
    // All Chapter 1 lessons should come before any Chapter 2 lessons
    // Expected: [lesson-ch1-1, lesson-ch1-2, lesson-ch1-3, lesson-ch2-1, lesson-ch2-2, lesson-ch2-3]
    //
    // The BUG: DB returns them interleaved: [lesson-ch1-1, lesson-ch2-1, lesson-ch1-2, lesson-ch2-2, lesson-ch1-3, lesson-ch2-3]
    const expectedLessonIds = [
      'lesson-ch1-1',
      'lesson-ch1-2',
      'lesson-ch1-3',
      'lesson-ch2-1',
      'lesson-ch2-2',
      'lesson-ch2-3',
    ]

    expect(resultLessonIds).toEqual(expectedLessonIds)
  })

  it('should return empty array when course is not found', async () => {
    const { getPayload } = await import('payload')
    const mockPayload: MockPayload = {
      findByID: vi.fn().mockResolvedValue(null),
    }
    ;(getPayload as Mock).mockResolvedValue(mockPayload)

    const result = await queryLessonsByCourse({ courseId: 'non-existent' })

    expect(result).toEqual([])
  })

  it('should return empty array when course is draft', async () => {
    const mockCourse = {
      id: 'course-1',
      status: 'draft',
      isActive: true,
    }

    const { getPayload } = await import('payload')
    const mockPayload: MockPayload = {
      findByID: vi.fn().mockResolvedValue(mockCourse),
    }
    ;(getPayload as Mock).mockResolvedValue(mockPayload)

    const result = await queryLessonsByCourse({ courseId: 'course-1' })

    expect(result).toEqual([])
  })

  it('should return empty array when course is inactive', async () => {
    const mockCourse = {
      id: 'course-1',
      status: 'published',
      isActive: false,
    }

    const { getPayload } = await import('payload')
    const mockPayload: MockPayload = {
      findByID: vi.fn().mockResolvedValue(mockCourse),
    }
    ;(getPayload as Mock).mockResolvedValue(mockPayload)

    const result = await queryLessonsByCourse({ courseId: 'course-1' })

    expect(result).toEqual([])
  })
})
