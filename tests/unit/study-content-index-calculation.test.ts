// @vitest-environment jsdom
/**
 * Unit test: StudyContent lesson index calculation
 *
 * Issue #1896: Practice page lesson card heading does not match lesson number
 *
 * This test verifies that the index calculation for lesson cards
 * produces correct sequential numbering across multiple chapters.
 */
import { describe, expect, it } from 'vitest'

interface MockLesson {
  id: string
  slug: string
  title: string
  type: 'learning' | 'practice' | 'exam'
  order: number
}

interface MockChapter {
  id: string
  slug: string
  title: string
  chapterLabel: string | null
  lessons: MockLesson[]
}

interface ChapterGroup {
  chapterSlug: string
  chapterTitle: string
  chapterLabel: string | null | undefined
  lessons: MockLesson[]
}

/**
 * Simulates the filteredLessons logic in StudyContent
 */
function getFilteredLessons(
  chapters: MockChapter[],
  lessonType: 'learning' | 'practice' | 'exam',
): (MockLesson & {
  _chapterSlug: string
  _chapterTitle: string
  _chapterLabel: string | null | undefined
})[] {
  return chapters.flatMap((chapter) => {
    const chapterSlug = chapter.slug || ''
    return (chapter.lessons ?? [])
      .filter((lesson) => lesson.type === lessonType)
      .map((lesson) => ({
        ...lesson,
        _chapterSlug: chapterSlug,
        _chapterTitle: chapter.title,
        _chapterLabel: chapter.chapterLabel,
      }))
  })
}

/**
 * Simulates the chapterGroups logic in StudyContent
 */
function getChapterGroups(filteredLessons: ReturnType<typeof getFilteredLessons>): ChapterGroup[] {
  const groups: ChapterGroup[] = []
  const groupMap = new Map<string, ChapterGroup>()

  for (const lesson of filteredLessons) {
    const key = lesson._chapterSlug
    const existing = groupMap.get(key)
    if (existing) {
      existing.lessons.push(lesson)
    } else {
      const group: ChapterGroup = {
        chapterSlug: lesson._chapterSlug,
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
 * Calculates the startIndex for a given group index (same logic as StudyContent)
 */
function getStartIndex(chapterGroups: ChapterGroup[], groupIdx: number): number {
  return chapterGroups.slice(0, groupIdx).reduce((sum, g) => sum + g.lessons.length, 0)
}

describe('StudyContent lesson index calculation', () => {
  describe('Two chapters with 3 practice lessons each', () => {
    const chapters: MockChapter[] = [
      {
        id: 'ch1',
        slug: 'chapter-1',
        title: 'Chapter 1',
        chapterLabel: 'Ch-1',
        lessons: [
          { id: 'l1', slug: 'lesson-1', title: 'Lesson 1', type: 'practice', order: 1 },
          { id: 'l2', slug: 'lesson-2', title: 'Lesson 2', type: 'practice', order: 2 },
          { id: 'l3', slug: 'lesson-3', title: 'Lesson 3', type: 'practice', order: 3 },
        ],
      },
      {
        id: 'ch2',
        slug: 'chapter-2',
        title: 'Chapter 2',
        chapterLabel: 'Ch-2',
        lessons: [
          { id: 'l4', slug: 'lesson-4', title: 'Lesson 4', type: 'practice', order: 1 },
          { id: 'l5', slug: 'lesson-5', title: 'Lesson 5', type: 'practice', order: 2 },
          { id: 'l6', slug: 'lesson-6', title: 'Lesson 6', type: 'practice', order: 3 },
        ],
      },
    ]

    it('should have 6 filtered lessons', () => {
      const filteredLessons = getFilteredLessons(chapters, 'practice')
      expect(filteredLessons.length).toBe(6)
    })

    it('should have 2 chapter groups', () => {
      const filteredLessons = getFilteredLessons(chapters, 'practice')
      const chapterGroups = getChapterGroups(filteredLessons)
      expect(chapterGroups.length).toBe(2)
    })

    it('Chapter 1 should have startIndex 0 and indices 1, 2, 3', () => {
      const filteredLessons = getFilteredLessons(chapters, 'practice')
      const chapterGroups = getChapterGroups(filteredLessons)

      const ch1Group = chapterGroups.find((g) => g.chapterSlug === 'chapter-1')!
      const ch1GroupIdx = chapterGroups.indexOf(ch1Group)
      const startIndex = getStartIndex(chapterGroups, ch1GroupIdx)

      expect(startIndex).toBe(0)
      expect(ch1Group.lessons.length).toBe(3)

      ch1Group.lessons.forEach((lesson, idx) => {
        const index = startIndex + idx + 1
        expect(index).toBe(idx + 1) // Should be 1, 2, 3
      })
    })

    it('Chapter 2 should have startIndex 3 and indices 4, 5, 6', () => {
      const filteredLessons = getFilteredLessons(chapters, 'practice')
      const chapterGroups = getChapterGroups(filteredLessons)

      const ch2Group = chapterGroups.find((g) => g.chapterSlug === 'chapter-2')!
      const ch2GroupIdx = chapterGroups.indexOf(ch2Group)
      const startIndex = getStartIndex(chapterGroups, ch2GroupIdx)

      expect(startIndex).toBe(3) // 3 lessons from Chapter 1
      expect(ch2Group.lessons.length).toBe(3)

      ch2Group.lessons.forEach((lesson, idx) => {
        const index = startIndex + idx + 1
        expect(index).toBe(4 + idx) // Should be 4, 5, 6
      })
    })
  })

  describe('Two chapters with different lesson counts', () => {
    const chapters: MockChapter[] = [
      {
        id: 'ch1',
        slug: 'chapter-1',
        title: 'Chapter 1',
        chapterLabel: 'Ch-1',
        lessons: [
          { id: 'l1', slug: 'lesson-1', title: 'Lesson 1', type: 'practice', order: 1 },
          { id: 'l2', slug: 'lesson-2', title: 'Lesson 2', type: 'practice', order: 2 },
        ],
      },
      {
        id: 'ch2',
        slug: 'chapter-2',
        title: 'Chapter 2',
        chapterLabel: 'Ch-2',
        lessons: [
          { id: 'l3', slug: 'lesson-3', title: 'Lesson 3', type: 'practice', order: 1 },
          { id: 'l4', slug: 'lesson-4', title: 'Lesson 4', type: 'practice', order: 2 },
          { id: 'l5', slug: 'lesson-5', title: 'Lesson 5', type: 'practice', order: 3 },
        ],
      },
    ]

    it('Chapter 2 should have startIndex 2 and indices 3, 4, 5', () => {
      const filteredLessons = getFilteredLessons(chapters, 'practice')
      const chapterGroups = getChapterGroups(filteredLessons)

      const ch2Group = chapterGroups.find((g) => g.chapterSlug === 'chapter-2')!
      const ch2GroupIdx = chapterGroups.indexOf(ch2Group)
      const startIndex = getStartIndex(chapterGroups, ch2GroupIdx)

      expect(startIndex).toBe(2) // 2 lessons from Chapter 1
      expect(ch2Group.lessons.length).toBe(3)

      ch2Group.lessons.forEach((lesson, idx) => {
        const index = startIndex + idx + 1
        expect(index).toBe(3 + idx) // Should be 3, 4, 5
      })
    })
  })

  describe('Chapter 1 has no practice lessons (only Chapter 2 has lessons)', () => {
    const chapters: MockChapter[] = [
      {
        id: 'ch1',
        slug: 'chapter-1',
        title: 'Chapter 1',
        chapterLabel: 'Ch-1',
        lessons: [
          { id: 'l1', slug: 'lesson-1', title: 'Lesson 1', type: 'learning', order: 1 },
          { id: 'l2', slug: 'lesson-2', title: 'Lesson 2', type: 'learning', order: 2 },
        ],
      },
      {
        id: 'ch2',
        slug: 'chapter-2',
        title: 'Chapter 2',
        chapterLabel: 'Ch-2',
        lessons: [
          { id: 'l3', slug: 'lesson-3', title: 'Lesson 3', type: 'practice', order: 1 },
          { id: 'l4', slug: 'lesson-4', title: 'Lesson 4', type: 'practice', order: 2 },
        ],
      },
    ]

    it('should only have 2 filtered lessons (from Chapter 2)', () => {
      const filteredLessons = getFilteredLessons(chapters, 'practice')
      expect(filteredLessons.length).toBe(2)
    })

    it('Chapter 2 should have startIndex 0 and indices 1, 2', () => {
      const filteredLessons = getFilteredLessons(chapters, 'practice')
      const chapterGroups = getChapterGroups(filteredLessons)

      expect(chapterGroups.length).toBe(1) // Only Chapter 2 has practice lessons

      const ch2Group = chapterGroups[0]!
      const startIndex = getStartIndex(chapterGroups, 0)

      expect(startIndex).toBe(0)
      expect(ch2Group.lessons.length).toBe(2)

      ch2Group.lessons.forEach((lesson, idx) => {
        const index = startIndex + idx + 1
        expect(index).toBe(idx + 1) // Should be 1, 2
      })
    })
  })
})
