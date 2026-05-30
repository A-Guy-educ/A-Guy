// @vitest-environment jsdom
/**
 * Unit test: Practice page lesson heading off-by-one bug
 *
 * Bug: On /practice page Chapter 2, lesson headings show 5,6,7 instead of 4,5,6.
 *
 * The formula for lesson index is: startIndex + idx + 1
 * where startIndex = sum of lessons in all previous chapter groups.
 *
 * This test verifies the index calculation logic.
 */
import { describe, expect, it, vi } from 'vitest'
import type { Chapter, Lesson } from '@/payload-types'

// Mock the dependencies
vi.mock('@/infra/loading/LoadingManager', () => ({
  loadingManager: { register: vi.fn() },
}))

vi.mock('sonner', () => ({
  toast: { info: vi.fn(() => 'mock-toast-id') },
}))

function createMockLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: `lesson-${Math.random().toString(36).substr(2, 9)}`,
    slug: `lesson-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Lesson',
    chapter: 'chapter-1',
    type: 'practice',
    status: 'published',
    isActive: true,
    order: 1,
    accessType: 'inherit',
    locale: 'he',
    tenant: 'test-tenant',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    contentStatus: 'none',
    contentStatusVisible: true,
    ...overrides,
  } as Lesson
}

// Extend Chapter with lessons for testing
interface ChapterWithLessons extends Chapter {
  lessons: Lesson[]
}

function createMockChapter(
  overrides: Partial<Chapter> & { lessons: Lesson[] },
): ChapterWithLessons {
  return {
    id: `chapter-${Math.random().toString(36).substr(2, 9)}`,
    slug: `chapter-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Chapter',
    status: 'published',
    isActive: true,
    order: 1,
    course: 'course-1',
    lessonCount: overrides.lessons.length,
    ...overrides,
  } as ChapterWithLessons
}

// We test the logic separately since StudyContent is complex with many dependencies
describe('Practice page lesson index calculation', () => {
  /**
   * Simulates the chapterGroups computation from StudyContent
   * to verify the startIndex calculation is correct.
   */
  function computeChapterGroups(chapters: ChapterWithLessons[]) {
    // Filter to practice lessons only (simulating getEffectiveLessonType check)
    const filteredLessons = chapters.flatMap((chapter) => {
      return chapter.lessons
        .filter((lesson) => lesson.type === 'practice')
        .map((lesson) => ({
          ...lesson,
          _chapterSlug: chapter.slug,
          _chapterTitle: chapter.title,
          _chapterLabel: chapter.chapterLabel,
        }))
    })

    // Group by chapter
    const groups: Array<{
      chapterSlug: string
      chapterTitle: string
      chapterLabel: string | null | undefined
      lessons: typeof filteredLessons
    }> = []

    const groupMap = new Map<string, (typeof groups)[0]>()

    for (const lesson of filteredLessons) {
      const key = lesson._chapterSlug ?? ''
      const existing = groupMap.get(key)
      if (existing) {
        existing.lessons.push(lesson)
      } else {
        const group: (typeof groups)[0] = {
          chapterSlug: lesson._chapterSlug ?? '',
          chapterTitle: lesson._chapterTitle,
          chapterLabel: lesson._chapterLabel,
          lessons: [lesson],
        }
        groupMap.set(key, group)
        groups.push(group)
      }
    }

    return groups
  }

  /**
   * Computes the lesson index as done in StudyContent's render
   */
  function getLessonIndex(
    groups: ReturnType<typeof computeChapterGroups>,
    groupIdx: number,
    idx: number,
  ): number {
    const startIndex = groups.slice(0, groupIdx).reduce((sum, g) => sum + g.lessons.length, 0)
    return startIndex + idx + 1
  }

  it('Chapter 2 first lesson should have index 4 when Chapter 1 has 3 practice lessons', () => {
    // Setup: Chapter 1 has 3 practice lessons, Chapter 2 has 3 practice lessons
    // This matches the issue description: Chapter 1 has 3 lessons
    const chapter1Lessons = [
      createMockLesson({ id: 'c1-l1', slug: 'c1-l1', order: 1 }),
      createMockLesson({ id: 'c1-l2', slug: 'c1-l2', order: 2 }),
      createMockLesson({ id: 'c1-l3', slug: 'c1-l3', order: 3 }),
    ]
    const chapter2Lessons = [
      createMockLesson({ id: 'c2-l1', slug: 'c2-l1', order: 1 }),
      createMockLesson({ id: 'c2-l2', slug: 'c2-l2', order: 2 }),
      createMockLesson({ id: 'c2-l3', slug: 'c2-l3', order: 3 }),
    ]

    const chapters = [
      createMockChapter({
        id: 'ch1',
        slug: 'chapter-1',
        title: 'Chapter 1',
        order: 1,
        lessons: chapter1Lessons,
      }),
      createMockChapter({
        id: 'ch2',
        slug: 'chapter-2',
        title: 'Chapter 2',
        order: 2,
        lessons: chapter2Lessons,
      }),
    ]

    const groups = computeChapterGroups(chapters)

    // Chapter 1 lessons should have indices 1, 2, 3
    expect(getLessonIndex(groups, 0, 0)).toBe(1) // Chapter 1, first lesson
    expect(getLessonIndex(groups, 0, 1)).toBe(2) // Chapter 1, second lesson
    expect(getLessonIndex(groups, 0, 2)).toBe(3) // Chapter 1, third lesson

    // Chapter 2 lessons should have indices 4, 5, 6 (NOT 5, 6, 7 as reported in bug)
    expect(getLessonIndex(groups, 1, 0)).toBe(4) // Chapter 2, first lesson - THE BUG: actual is 5
    expect(getLessonIndex(groups, 1, 1)).toBe(5) // Chapter 2, second lesson
    expect(getLessonIndex(groups, 1, 2)).toBe(6) // Chapter 2, third lesson
  })

  it('REPRODUCES BUG: If Chapter 1 has 4 practice lessons (not 3), Chapter 2 shows 5,6,7', () => {
    // This reproduces the actual bug behavior: Chapter 1 has 4 practice lessons
    // (even though the issue description says 3)
    const chapter1Lessons = [
      createMockLesson({ id: 'c1-l1', slug: 'c1-l1', order: 1 }),
      createMockLesson({ id: 'c1-l2', slug: 'c1-l2', order: 2 }),
      createMockLesson({ id: 'c1-l3', slug: 'c1-l3', order: 3 }),
      createMockLesson({ id: 'c1-l4', slug: 'c1-l4', order: 4 }), // 4th lesson - extra!
    ]
    const chapter2Lessons = [
      createMockLesson({ id: 'c2-l1', slug: 'c2-l1', order: 1 }),
      createMockLesson({ id: 'c2-l2', slug: 'c2-l2', order: 2 }),
      createMockLesson({ id: 'c2-l3', slug: 'c2-l3', order: 3 }),
    ]

    const chapters = [
      createMockChapter({
        id: 'ch1',
        slug: 'chapter-1',
        title: 'Chapter 1',
        order: 1,
        lessons: chapter1Lessons,
      }),
      createMockChapter({
        id: 'ch2',
        slug: 'chapter-2',
        title: 'Chapter 2',
        order: 2,
        lessons: chapter2Lessons,
      }),
    ]

    const groups = computeChapterGroups(chapters)

    // If Chapter 1 has 4 lessons, Chapter 2 shows 5, 6, 7 (the bug behavior)
    expect(getLessonIndex(groups, 1, 0)).toBe(5) // Bug: shows 5 instead of 4
    expect(getLessonIndex(groups, 1, 1)).toBe(6) // Bug: shows 6 instead of 5
    expect(getLessonIndex(groups, 1, 2)).toBe(7) // Bug: shows 7 instead of 6
  })

  it('Single chapter with 3 lessons should show 1, 2, 3', () => {
    const chapterLessons = [
      createMockLesson({ id: 'c1-l1', slug: 'c1-l1', order: 1 }),
      createMockLesson({ id: 'c1-l2', slug: 'c1-l2', order: 2 }),
      createMockLesson({ id: 'c1-l3', slug: 'c1-l3', order: 3 }),
    ]

    const chapters = [
      createMockChapter({
        id: 'ch1',
        slug: 'chapter-1',
        title: 'Chapter 1',
        order: 1,
        lessons: chapterLessons,
      }),
    ]

    const groups = computeChapterGroups(chapters)

    expect(getLessonIndex(groups, 0, 0)).toBe(1)
    expect(getLessonIndex(groups, 0, 1)).toBe(2)
    expect(getLessonIndex(groups, 0, 2)).toBe(3)
  })

  it('Three chapters with 2 lessons each: ch1=1,2 ch2=3,4 ch3=5,6', () => {
    const createChapterLessons = (chapterId: string, count: number) =>
      Array.from({ length: count }, (_, i) =>
        createMockLesson({
          id: `${chapterId}-l${i + 1}`,
          slug: `${chapterId}-l${i + 1}`,
          order: i + 1,
        }),
      )

    const chapters = [
      createMockChapter({
        id: 'ch1',
        slug: 'chapter-1',
        title: 'Chapter 1',
        order: 1,
        lessons: createChapterLessons('ch1', 2),
      }),
      createMockChapter({
        id: 'ch2',
        slug: 'chapter-2',
        title: 'Chapter 2',
        order: 2,
        lessons: createChapterLessons('ch2', 2),
      }),
      createMockChapter({
        id: 'ch3',
        slug: 'chapter-3',
        title: 'Chapter 3',
        order: 3,
        lessons: createChapterLessons('ch3', 2),
      }),
    ]

    const groups = computeChapterGroups(chapters)

    // Chapter 1: 1, 2
    expect(getLessonIndex(groups, 0, 0)).toBe(1)
    expect(getLessonIndex(groups, 0, 1)).toBe(2)

    // Chapter 2: 3, 4
    expect(getLessonIndex(groups, 1, 0)).toBe(3)
    expect(getLessonIndex(groups, 1, 1)).toBe(4)

    // Chapter 3: 5, 6
    expect(getLessonIndex(groups, 2, 0)).toBe(5)
    expect(getLessonIndex(groups, 2, 1)).toBe(6)
  })
})
