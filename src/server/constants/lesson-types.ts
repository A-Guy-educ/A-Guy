export const LESSON_TYPES = ['learning', 'practice', 'exam', 'interactive_demo'] as const

export type LessonType = (typeof LESSON_TYPES)[number]

export const DEFAULT_LESSON_TYPE: LessonType = 'learning'

export function getEffectiveLessonType(type: string | null | undefined): LessonType {
  if (type && LESSON_TYPES.includes(type as LessonType)) {
    return type as LessonType
  }
  return DEFAULT_LESSON_TYPE
}
