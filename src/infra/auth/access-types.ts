/**
 * Access Types — shared constants for access control levels
 *
 * Canonical location: @/infra/auth/access-types
 * Re-exported from @/server/constants/access-types for backward compat
 */

<<<<<<< HEAD
export const ACCESS_TYPES = ['free', 'mandatory', 'gated', 'accessCode'] as const
=======
export const ACCESS_TYPES = ['free', 'mandatory', 'gated', 'paid'] as const
>>>>>>> origin/dev

export type AccessType = (typeof ACCESS_TYPES)[number]

export const LESSON_ACCESS_TYPES = ['inherit', ...ACCESS_TYPES] as const

export type LessonAccessType = (typeof LESSON_ACCESS_TYPES)[number]

export const DEFAULT_ACCESS_TYPE: AccessType = 'free'

export const DEFAULT_PAGE_ACCESS_TYPE: AccessType = 'free'

export const DEFAULT_LESSON_ACCESS_TYPE: LessonAccessType = 'inherit'

/** Fallback gated delay before lock (ms). Overridden by admin config `gated_delay_ms`. */
export const GATED_DELAY_MS = 5 * 60 * 1000

/** Fallback warning duration before lock (ms). Overridden by admin config `gated_warning_ms`. */
export const GATED_WARNING_MS = 30 * 1000

/**
 * Resolve the effective access type for a lesson.
 * If the lesson is set to 'inherit', use the course's access type.
 */
export function resolveAccessType(
  lessonAccessType: string | null | undefined,
  courseAccessType: string | null | undefined,
): AccessType {
  if (lessonAccessType && lessonAccessType !== 'inherit') {
    if (ACCESS_TYPES.includes(lessonAccessType as AccessType)) {
      return lessonAccessType as AccessType
    }
  }
  if (courseAccessType && ACCESS_TYPES.includes(courseAccessType as AccessType)) {
    return courseAccessType as AccessType
  }
  return DEFAULT_ACCESS_TYPE
}
