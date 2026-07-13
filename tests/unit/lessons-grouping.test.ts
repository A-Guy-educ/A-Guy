import '@testing-library/jest-dom'
import { describe, expect, it } from 'vitest'
import type { Chapter, Lesson } from '@/payload-types'
import {
  defaultExpandedChapterIds,
  groupLessonsForTimeline,
} from '@/app/(frontend)/courses/[courseSlug]/_components/LessonListTab/lessons-grouping'
import { applyLessonFilters } from '@/app/(frontend)/courses/[courseSlug]/_components/LessonListTab/apply-filters'

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: overrides.id ?? `lesson-${Math.random()}`,
    title: overrides.title ?? 'Lesson',
    slug: overrides.slug ?? 'lesson',
    chapter: overrides.chapter ?? 'chapter-1',
    course: overrides.course ?? 'course-1',
    type: overrides.type ?? 'learning',
    status: overrides.status ?? 'published',
    isActive: overrides.isActive ?? true,
    order: overrides.order ?? 1,
    accessType: overrides.accessType ?? 'inherit',
    locale: overrides.locale ?? 'he',
    tenant: overrides.tenant ?? 'tenant-1',
    createdAt: overrides.createdAt ?? '2024-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2024-01-01T00:00:00.000Z',
    contentStatus: overrides.contentStatus ?? 'none',
    contentStatusVisible: overrides.contentStatusVisible ?? true,
  } as Lesson
}

function makeChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: overrides.id ?? `chapter-${Math.random()}`,
    title: overrides.title ?? 'Chapter',
    course: overrides.course ?? 'course-1',
    order: overrides.order ?? 1,
    status: overrides.status ?? 'published',
    isActive: overrides.isActive ?? true,
    locale: overrides.locale ?? 'he',
    tenant: overrides.tenant ?? 'tenant-1',
    createdAt: overrides.createdAt ?? '2024-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2024-01-01T00:00:00.000Z',
  } as Chapter
}

const ALWAYS_FREE = () => true

describe('groupLessonsForTimeline', () => {
  it('orders chapters by chapter.order and lessons by lesson.order', () => {
    const chapter2 = makeChapter({ id: 'ch-2', title: 'Two', order: 2 })
    const chapter1 = makeChapter({ id: 'ch-1', title: 'One', order: 1 })
    const lessons: Lesson[] = [
      makeLesson({ id: 'l1', order: 2, chapter: 'ch-1' }),
      makeLesson({ id: 'l2', order: 1, chapter: 'ch-2' }),
      makeLesson({ id: 'l3', order: 1, chapter: 'ch-1' }),
    ]

    const result = groupLessonsForTimeline({
      lessons,
      chapters: [chapter2, chapter1],
      lessonType: 'learning',
      resolveProgress: () => 0,
      resolveCompleted: () => false,
      isLessonEntitled: ALWAYS_FREE,
    })

    expect(result.groups.map((g) => g.chapter.id)).toEqual(['ch-1', 'ch-2'])
    expect(result.groups[0].lessons.map((l) => l.lesson.id)).toEqual(['l3', 'l1'])
    expect(result.entries.map((e) => e.lesson.id)).toEqual(['l3', 'l1', 'l2'])
  })

  it('promotes the first non-completed lesson to active', () => {
    const chapter = makeChapter({ id: 'ch-1' })
    const lessons: Lesson[] = [
      makeLesson({ id: 'l1', chapter: 'ch-1' }),
      makeLesson({ id: 'l2', chapter: 'ch-1' }),
    ]
    const result = groupLessonsForTimeline({
      lessons,
      chapters: [chapter],
      lessonType: 'learning',
      resolveProgress: (id) => (id === 'l1' ? 100 : 0),
      resolveCompleted: (id) => id === 'l1',
      isLessonEntitled: ALWAYS_FREE,
    })

    expect(result.activeEntry?.lesson.id).toBe('l2')
    expect(result.activeEntry?.state).toBe('active')
    expect(result.activeChapterId).toBe('ch-1')
    expect(result.completedCount).toBe(1)
    expect(result.overallPercent).toBe(50)
    expect(result.allCompleted).toBe(false)
  })

  it('falls back to the first locked lesson when nothing is available', () => {
    const chapter = makeChapter({ id: 'ch-1' })
    const lessons: Lesson[] = [
      makeLesson({ id: 'l1', chapter: 'ch-1', contentStatus: 'soon' }),
      makeLesson({ id: 'l2', chapter: 'ch-1', contentStatus: 'soon' }),
    ]
    const result = groupLessonsForTimeline({
      lessons,
      chapters: [chapter],
      lessonType: 'learning',
      resolveProgress: () => 0,
      resolveCompleted: () => false,
      isLessonEntitled: ALWAYS_FREE,
    })

    expect(result.activeEntry?.lesson.id).toBe('l1')
    expect(result.activeEntry?.state).toBe('active')
    expect(result.completedCount).toBe(0)
    expect(result.allCompleted).toBe(false)
  })

  it('reports allCompleted when every lesson is finished', () => {
    const chapter = makeChapter({ id: 'ch-1' })
    const lessons: Lesson[] = [
      makeLesson({ id: 'l1', chapter: 'ch-1' }),
      makeLesson({ id: 'l2', chapter: 'ch-1' }),
    ]
    const result = groupLessonsForTimeline({
      lessons,
      chapters: [chapter],
      lessonType: 'learning',
      resolveProgress: () => 100,
      resolveCompleted: () => true,
      isLessonEntitled: ALWAYS_FREE,
    })

    expect(result.allCompleted).toBe(true)
    expect(result.activeEntry).toBeUndefined()
    expect(result.activeChapterId).toBeUndefined()
    expect(result.overallPercent).toBe(100)
  })

  it('keeps empty chapters in the group list so the map is complete', () => {
    const populated = makeChapter({ id: 'ch-1', order: 1 })
    const empty = makeChapter({ id: 'ch-2', order: 2 })
    const lessons: Lesson[] = [makeLesson({ id: 'l1', chapter: 'ch-1', order: 1 })]

    const result = groupLessonsForTimeline({
      lessons,
      chapters: [populated, empty],
      lessonType: 'learning',
      resolveProgress: () => 0,
      resolveCompleted: () => false,
      isLessonEntitled: ALWAYS_FREE,
    })

    expect(result.groups.map((g) => g.chapter.id)).toEqual(['ch-1', 'ch-2'])
    expect(result.groups[1].lessons).toHaveLength(0)
    expect(result.groups[1].totalCount).toBe(0)
  })

  it('treats a paid lesson without entitlement as locked, then promotes it to active when no other candidate exists', () => {
    const chapter = makeChapter({ id: 'ch-1' })
    const paidLesson = makeLesson({ id: 'l1', chapter: 'ch-1', accessType: 'paid' })
    const freeLesson = makeLesson({ id: 'l2', chapter: 'ch-1', accessType: 'inherit' })

    const blockedResult = groupLessonsForTimeline({
      lessons: [paidLesson],
      chapters: [chapter],
      lessonType: 'learning',
      resolveProgress: () => 0,
      resolveCompleted: () => false,
      isLessonEntitled: (id) => id !== 'l1',
    })
    // No other lesson exists, so the only candidate gets promoted to active.
    expect(blockedResult.activeEntry?.state).toBe('active')
    expect(blockedResult.activeEntry?.lesson.id).toBe('l1')

    const mixedResult = groupLessonsForTimeline({
      lessons: [paidLesson, freeLesson],
      chapters: [chapter],
      lessonType: 'learning',
      resolveProgress: () => 0,
      resolveCompleted: () => false,
      isLessonEntitled: (id) => id !== 'l1',
    })
    // The free lesson wins the active slot, leaving the paid lesson locked.
    expect(mixedResult.activeEntry?.lesson.id).toBe('l2')
    const paid = mixedResult.entries.find((e) => e.lesson.id === 'l1')
    expect(paid?.state).toBe('locked')
  })
})

describe('defaultExpandedChapterIds', () => {
  it('returns only the active chapter', () => {
    const chapter = makeChapter({ id: 'ch-1' })
    const result = groupLessonsForTimeline({
      lessons: [makeLesson({ id: 'l1', chapter: 'ch-1' })],
      chapters: [chapter],
      lessonType: 'learning',
      resolveProgress: () => 0,
      resolveCompleted: () => false,
      isLessonEntitled: ALWAYS_FREE,
    })
    const expanded = defaultExpandedChapterIds(result)
    expect(Array.from(expanded)).toEqual(['ch-1'])
  })

  it('returns an empty set when there is no active lesson', () => {
    const chapter = makeChapter({ id: 'ch-1' })
    const result = groupLessonsForTimeline({
      lessons: [makeLesson({ id: 'l1', chapter: 'ch-1' })],
      chapters: [chapter],
      lessonType: 'learning',
      resolveProgress: () => 100,
      resolveCompleted: () => true,
      isLessonEntitled: ALWAYS_FREE,
    })
    expect(defaultExpandedChapterIds(result).size).toBe(0)
  })
})

describe('applyLessonFilters', () => {
  it('returns every group when mode is all', () => {
    const result = groupLessonsForTimeline({
      lessons: [
        makeLesson({ id: 'l1', chapter: 'ch-1' }),
        makeLesson({ id: 'l2', chapter: 'ch-2' }),
      ],
      chapters: [makeChapter({ id: 'ch-1' }), makeChapter({ id: 'ch-2' })],
      lessonType: 'learning',
      resolveProgress: () => 0,
      resolveCompleted: () => false,
      isLessonEntitled: ALWAYS_FREE,
    })
    const filtered = applyLessonFilters(result.groups, 'all', undefined)
    expect(filtered).toHaveLength(2)
  })

  it('keeps only the active chapter when mode is focus', () => {
    const result = groupLessonsForTimeline({
      lessons: [
        makeLesson({ id: 'l1', chapter: 'ch-1' }),
        makeLesson({ id: 'l2', chapter: 'ch-2' }),
      ],
      chapters: [makeChapter({ id: 'ch-1' }), makeChapter({ id: 'ch-2' })],
      lessonType: 'learning',
      resolveProgress: () => 0,
      resolveCompleted: () => false,
      isLessonEntitled: ALWAYS_FREE,
    })
    const filtered = applyLessonFilters(result.groups, 'focus', 'ch-1')
    expect(filtered.map((g) => g.chapter.id)).toEqual(['ch-1'])
  })

  it('falls back to all when focus has no active chapter', () => {
    const result = groupLessonsForTimeline({
      lessons: [makeLesson({ id: 'l1', chapter: 'ch-1' })],
      chapters: [makeChapter({ id: 'ch-1' })],
      lessonType: 'learning',
      resolveProgress: () => 100,
      resolveCompleted: () => true,
      isLessonEntitled: ALWAYS_FREE,
    })
    const filtered = applyLessonFilters(result.groups, 'focus', undefined)
    expect(filtered).toHaveLength(1)
  })

  it('strips completed lessons when mode is hideCompleted', () => {
    const result = groupLessonsForTimeline({
      lessons: [
        makeLesson({ id: 'l1', chapter: 'ch-1' }),
        makeLesson({ id: 'l2', chapter: 'ch-1' }),
      ],
      chapters: [makeChapter({ id: 'ch-1' })],
      lessonType: 'learning',
      resolveProgress: (id) => (id === 'l1' ? 100 : 0),
      resolveCompleted: (id) => id === 'l1',
      isLessonEntitled: ALWAYS_FREE,
    })
    const filtered = applyLessonFilters(result.groups, 'hideCompleted', undefined)
    expect(filtered[0].lessons.map((l) => l.lesson.id)).toEqual(['l2'])
  })

  it('removes chapters with no visible lessons in hideCompleted', () => {
    const result = groupLessonsForTimeline({
      lessons: [
        makeLesson({ id: 'l1', chapter: 'ch-1' }),
        makeLesson({ id: 'l2', chapter: 'ch-2' }),
      ],
      chapters: [makeChapter({ id: 'ch-1' }), makeChapter({ id: 'ch-2' })],
      lessonType: 'learning',
      resolveProgress: (id) => (id === 'l2' ? 100 : 0),
      resolveCompleted: (id) => id === 'l2',
      isLessonEntitled: ALWAYS_FREE,
    })
    const filtered = applyLessonFilters(result.groups, 'hideCompleted', undefined)
    expect(filtered.map((g) => g.chapter.id)).toEqual(['ch-1'])
  })
})
