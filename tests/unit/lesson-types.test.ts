import { describe, expect, it } from 'vitest'

import {
  DEFAULT_LESSON_TYPE,
  getEffectiveLessonType,
  LESSON_TYPES,
} from '@/lib/constants/lesson-types'

describe('lesson type constants', () => {
  it('exposes the supported lesson types', () => {
    expect(LESSON_TYPES).toEqual(['learning', 'practice', 'exam'])
  })

  it('uses learning as the default type', () => {
    expect(DEFAULT_LESSON_TYPE).toBe('learning')
  })
})

describe('getEffectiveLessonType', () => {
  it('returns valid types as-is', () => {
    expect(getEffectiveLessonType('learning')).toBe('learning')
    expect(getEffectiveLessonType('practice')).toBe('practice')
    expect(getEffectiveLessonType('exam')).toBe('exam')
  })

  it('falls back to learning for missing values', () => {
    expect(getEffectiveLessonType(undefined)).toBe('learning')
    expect(getEffectiveLessonType(null)).toBe('learning')
    expect(getEffectiveLessonType('')).toBe('learning')
  })

  it('falls back to learning for invalid values', () => {
    expect(getEffectiveLessonType('invalid')).toBe('learning')
  })
})

describe('chapter filtering by lesson type', () => {
  const mockChapters = [
    {
      id: '1',
      title: 'Chapter with learning',
      lessons: [
        { id: 'l1', type: 'learning' },
        { id: 'l2', type: 'practice' },
      ],
    },
    {
      id: '2',
      title: 'Chapter with only practice',
      lessons: [{ id: 'l3', type: 'practice' }],
    },
    {
      id: '3',
      title: 'Chapter with null type',
      lessons: [{ id: 'l4', type: null }],
    },
  ]

  it('hides chapters with zero matching lessons', () => {
    const filtered = mockChapters
      .map((chapter) => ({
        ...chapter,
        lessons: chapter.lessons.filter((lesson) => getEffectiveLessonType(lesson.type) === 'exam'),
      }))
      .filter((chapter) => chapter.lessons.length > 0)

    expect(filtered).toHaveLength(0)
  })

  it('keeps chapters with matching lessons', () => {
    const filtered = mockChapters
      .map((chapter) => ({
        ...chapter,
        lessons: chapter.lessons.filter(
          (lesson) => getEffectiveLessonType(lesson.type) === 'learning',
        ),
      }))
      .filter((chapter) => chapter.lessons.length > 0)

    expect(filtered).toHaveLength(2)
  })

  it('includes null types in the learning filter', () => {
    const filtered = mockChapters
      .map((chapter) => ({
        ...chapter,
        lessons: chapter.lessons.filter(
          (lesson) => getEffectiveLessonType(lesson.type) === 'learning',
        ),
      }))
      .filter((chapter) => chapter.lessons.length > 0)

    const chapterWithNull = filtered.find((chapter) => chapter.id === '3')
    expect(chapterWithNull).toBeDefined()
    expect(chapterWithNull?.lessons).toHaveLength(1)
  })
})
