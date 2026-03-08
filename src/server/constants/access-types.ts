/**
 * Access Types — re-exported from canonical location @/infra/auth/access-types
 *
 * Kept here for backward compatibility with server-layer imports.
 * New code should import from '@/infra/auth/access-types' directly.
 */
export {
  ACCESS_TYPES,
  type AccessType,
  LESSON_ACCESS_TYPES,
  type LessonAccessType,
  DEFAULT_ACCESS_TYPE,
  DEFAULT_PAGE_ACCESS_TYPE,
  DEFAULT_LESSON_ACCESS_TYPE,
  GATED_DELAY_MS,
  GATED_WARNING_MS,
  resolveAccessType,
} from '@/infra/auth/access-types'
