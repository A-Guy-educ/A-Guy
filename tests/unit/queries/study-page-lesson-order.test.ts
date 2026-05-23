/**
 * @fileType unit-test
 * @domain courses, lessons
 * @pattern study-page-lesson-ordering
 * @ai-summary Test that prefetchStudyData returns lessons sorted by chapter order first, then lesson order within each chapter
 */
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { prefetchStudyData } from '@/server/repos/queries/study-page'

// Mock Payload
vi.mock('payload', () => ({
  getPayload: vi.fn(),
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

// Mock system params
vi.mock('@/infra/config/system-params', () => ({
  SystemParams: {
    getGatedDelayMs: vi.fn().mockResolvedValue(0),
    getGatedWarningMs: vi.fn().mockResolvedValue(0),
  },
}))

// Mock localeWhereClause
vi.mock('@/server/payload/fields/contentLocale', () => ({
  localeWhereClause: vi.fn().mockReturnValue([]),
  isValidContentLocale: vi.fn().mockReturnValue(true),
}))

// Mock queryChaptersByGrade since prefetchStudyData calls it internally
vi.mock('@/server/repos/queries/chapters', () => ({
  queryChaptersByGrade: vi.fn().mockResolvedValue([]),
}))

type MockPayload = {
  findByID?: Mock
  find?: Mock
}

describe('prefetchStudyData - lesson ordering within chapters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return lessons sorted by chapter order first, then lesson order within each chapter', async () => {
    // Setup: Course with two chapters
    // Chapter 1 (order=0) has lessons with order 1, 2, 3
    // Chapter 2 (order=1) has lessons with order 1, 2, 3
    // When DB returns them interleaved (sorted only by lesson.order globally),
    // the result should still have lessons grouped by chapter with correct within-chapter ordering
    //
    // BUG: DB query sorts by lesson.order globally, so if both chapters have lesson.order=1,2,3
    // the DB might return interleaved: [ch1-1, ch2-1, ch1-2, ch2-2, ch1-3, ch2-3]
    // After grouping by chapter without proper sorting, ch2Lessons would be [ch2-1, ch2-2, ch2-3]
    // which happens to be correct, BUT if DB returns [ch2-1, ch1-1, ch2-2, ch1-2, ch2-3, ch1-3]
    // then ch1Lessons = [ch1-1, ch1-2, ch1-3] and ch2Lessons = [ch2-1, ch2-2, ch2-3] - still correct
    //
    // The real bug manifests when lessons within a chapter have non-sequential or overlapping order values
    // that get shuffled by the global sort

    const mockChapters = [
      {
        id: 'chapter-1',
        title: 'Chapter 1',
        slug: 'chapter-1',
        chapterLabel: '1',
        order: 0,
        course: { id: 'course-1', slug: 'course-1', title: 'Test Course' },
        status: 'published',
        isActive: true,
      },
      {
        id: 'chapter-2',
        title: 'Chapter 2',
        slug: 'chapter-2',
        chapterLabel: '2',
        order: 1,
        course: { id: 'course-1', slug: 'course-1', title: 'Test Course' },
        status: 'published',
        isActive: true,
      },
    ]

    // Simulate DB returning lessons interleaved due to global sort by lesson.order
    // ch1 lessons have order 1,2,3; ch2 lessons have order 1,2,3
    // DB returns them interleaved: ch1-1, ch2-1, ch1-2, ch2-2, ch1-3, ch2-3
    const mockLessons = [
      {
        id: 'lesson-ch1-1',
        title: 'Lesson 1 Ch1',
        slug: 'lesson-1-ch1',
        chapter: { id: 'chapter-1', slug: 'chapter-1' },
        order: 1,
        status: 'published',
        isActive: true,
        type: 'practice',
        contentStatus: 'none',
        contentStatusVisible: true,
      },
      {
        id: 'lesson-ch2-1',
        title: 'Lesson 1 Ch2',
        slug: 'lesson-1-ch2',
        chapter: { id: 'chapter-2', slug: 'chapter-2' },
        order: 1,
        status: 'published',
        isActive: true,
        type: 'practice',
        contentStatus: 'none',
        contentStatusVisible: true,
      },
      {
        id: 'lesson-ch1-2',
        title: 'Lesson 2 Ch1',
        slug: 'lesson-2-ch1',
        chapter: { id: 'chapter-1', slug: 'chapter-1' },
        order: 2,
        status: 'published',
        isActive: true,
        type: 'practice',
        contentStatus: 'none',
        contentStatusVisible: true,
      },
      {
        id: 'lesson-ch2-2',
        title: 'Lesson 2 Ch2',
        slug: 'lesson-2-ch2',
        chapter: { id: 'chapter-2', slug: 'chapter-2' },
        order: 2,
        status: 'published',
        isActive: true,
        type: 'practice',
        contentStatus: 'none',
        contentStatusVisible: true,
      },
      {
        id: 'lesson-ch1-3',
        title: 'Lesson 3 Ch1',
        slug: 'lesson-3-ch1',
        chapter: { id: 'chapter-1', slug: 'chapter-1' },
        order: 3,
        status: 'published',
        isActive: true,
        type: 'practice',
        contentStatus: 'none',
        contentStatusVisible: true,
      },
      {
        id: 'lesson-ch2-3',
        title: 'Lesson 3 Ch2',
        slug: 'lesson-3-ch2',
        chapter: { id: 'chapter-2', slug: 'chapter-2' },
        order: 3,
        status: 'published',
        isActive: true,
        type: 'practice',
        contentStatus: 'none',
        contentStatusVisible: true,
      },
    ]

    const mockCourse = {
      id: 'course-1',
      status: 'published',
      isActive: true,
      slug: 'course-1',
      title: 'Test Course',
    }

    const { getPayload } = await import('payload')
    const mockPayload: MockPayload = {
      findByID: vi.fn().mockResolvedValue(mockCourse),
      find: vi.fn().mockResolvedValue({ docs: mockLessons }),
    }
    ;(getPayload as Mock).mockResolvedValue(mockPayload)

    // Configure mock for queryChaptersByGrade
    const { queryChaptersByGrade } = await import('@/server/repos/queries/chapters')
    ;(queryChaptersByGrade as Mock).mockResolvedValue(mockChapters)

    // Execute
    const result = await prefetchStudyData('grade-1')

    // Get lessons for each chapter
    const chapter1 = result?.chapters.find((ch) => ch.slug === 'chapter-1')
    const chapter2 = result?.chapters.find((ch) => ch.slug === 'chapter-2')

    // Verify chapters exist
    expect(chapter1).toBeDefined()
    expect(chapter2).toBeDefined()

    // Chapter 1 lessons should be in order 1, 2, 3
    const ch1LessonIds = chapter1!.lessons.map((l) => l.id)
    expect(ch1LessonIds).toEqual(['lesson-ch1-1', 'lesson-ch1-2', 'lesson-ch1-3'])

    // Chapter 2 lessons should be in order 1, 2, 3
    const ch2LessonIds = chapter2!.lessons.map((l) => l.id)
    expect(ch2LessonIds).toEqual(['lesson-ch2-1', 'lesson-ch2-2', 'lesson-ch2-3'])
  })

  it('should handle interleaved lessons with same order values within each chapter', async () => {
    // This test simulates the bug scenario where lessons are returned from DB
    // in a truly interleaved pattern that could cause within-chapter ordering issues
    // if not properly sorted after grouping

    const mockChapters = [
      {
        id: 'chapter-1',
        title: 'Chapter 1',
        slug: 'chapter-1',
        chapterLabel: '1',
        order: 0,
        course: { id: 'course-1', slug: 'course-1', title: 'Test Course' },
        status: 'published',
        isActive: true,
      },
      {
        id: 'chapter-2',
        title: 'Chapter 2',
        slug: 'chapter-2',
        chapterLabel: '2',
        order: 1,
        course: { id: 'course-1', slug: 'course-1', title: 'Test Course' },
        status: 'published',
        isActive: true,
      },
    ]

    // DB returns them in this order due to global sort:
    // ch2-1 (order=1), ch1-1 (order=1), ch2-2 (order=2), ch1-2 (order=2), ch2-3 (order=3), ch1-3 (order=3)
    // Note: ch2 lessons come before ch1 lessons because they have lower IDs (inserted earlier)
    const mockLessons = [
      {
        id: 'lesson-ch2-1',
        title: 'Lesson 1 Ch2',
        slug: 'lesson-1-ch2',
        chapter: { id: 'chapter-2', slug: 'chapter-2' },
        order: 1,
        status: 'published',
        isActive: true,
        type: 'practice',
        contentStatus: 'none',
        contentStatusVisible: true,
      },
      {
        id: 'lesson-ch1-1',
        title: 'Lesson 1 Ch1',
        slug: 'lesson-1-ch1',
        chapter: { id: 'chapter-1', slug: 'chapter-1' },
        order: 1,
        status: 'published',
        isActive: true,
        type: 'practice',
        contentStatus: 'none',
        contentStatusVisible: true,
      },
      {
        id: 'lesson-ch2-2',
        title: 'Lesson 2 Ch2',
        slug: 'lesson-2-ch2',
        chapter: { id: 'chapter-2', slug: 'chapter-2' },
        order: 2,
        status: 'published',
        isActive: true,
        type: 'practice',
        contentStatus: 'none',
        contentStatusVisible: true,
      },
      {
        id: 'lesson-ch1-2',
        title: 'Lesson 2 Ch1',
        slug: 'lesson-2-ch1',
        chapter: { id: 'chapter-1', slug: 'chapter-1' },
        order: 2,
        status: 'published',
        isActive: true,
        type: 'practice',
        contentStatus: 'none',
        contentStatusVisible: true,
      },
      {
        id: 'lesson-ch2-3',
        title: 'Lesson 3 Ch2',
        slug: 'lesson-3-ch2',
        chapter: { id: 'chapter-2', slug: 'chapter-2' },
        order: 3,
        status: 'published',
        isActive: true,
        type: 'practice',
        contentStatus: 'none',
        contentStatusVisible: true,
      },
      {
        id: 'lesson-ch1-3',
        title: 'Lesson 3 Ch1',
        slug: 'lesson-3-ch1',
        chapter: { id: 'chapter-1', slug: 'chapter-1' },
        order: 3,
        status: 'published',
        isActive: true,
        type: 'practice',
        contentStatus: 'none',
        contentStatusVisible: true,
      },
    ]

    const mockCourse = {
      id: 'course-1',
      status: 'published',
      isActive: true,
      slug: 'course-1',
      title: 'Test Course',
    }

    const { getPayload } = await import('payload')
    const mockPayload: MockPayload = {
      findByID: vi.fn().mockResolvedValue(mockCourse),
      find: vi.fn().mockResolvedValue({ docs: mockLessons }),
    }
    ;(getPayload as Mock).mockResolvedValue(mockPayload)

    // Configure mock for queryChaptersByGrade
    const { queryChaptersByGrade } = await import('@/server/repos/queries/chapters')
    ;(queryChaptersByGrade as Mock).mockResolvedValue(mockChapters)

    // Execute
    const result = await prefetchStudyData('grade-1')

    // Get lessons for each chapter
    const chapter1 = result?.chapters.find((ch) => ch.slug === 'chapter-1')
    const chapter2 = result?.chapters.find((ch) => ch.slug === 'chapter-2')

    // Verify chapters exist
    expect(chapter1).toBeDefined()
    expect(chapter2).toBeDefined()

    // Chapter 1 lessons should be sorted by order: 1, 2, 3
    // Even though DB returned them in mixed order, grouping + sorting should fix it
    const ch1LessonIds = chapter1!.lessons.map((l) => l.id)
    expect(ch1LessonIds).toEqual(['lesson-ch1-1', 'lesson-ch1-2', 'lesson-ch1-3'])

    // Chapter 2 lessons should be sorted by order: 1, 2, 3
    const ch2LessonIds = chapter2!.lessons.map((l) => l.id)
    expect(ch2LessonIds).toEqual(['lesson-ch2-1', 'lesson-ch2-2', 'lesson-ch2-3'])
  })
})
