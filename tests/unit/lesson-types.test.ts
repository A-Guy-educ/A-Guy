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
