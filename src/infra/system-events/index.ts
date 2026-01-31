/**
 * System Events - Public API
 *
 * Client-side pub/sub event bus with schema validation.
 *
 * @example
 * ```typescript
 * import { systemEventBus, SYSTEM_EVENTS, useSystemEvent } from '@/infra/system-events'
 *
 * // Emit an event
 * systemEventBus.emit(SYSTEM_EVENTS.PAGE_VIEWED, { page_path: '/courses' })
 *
 * // Subscribe to an event
 * useSystemEvent(SYSTEM_EVENTS.LESSON_STARTED, (envelope) => {
 *   console.log('Lesson started:', envelope.payload.lesson_id)
 * })
 * ```
 */

// Core bus
export { BUS_VERSION, systemEventBus } from './bus'

// Types
export type {
  AnySystemEventHandler,
  SystemEventEnvelope,
  SystemEventHandler,
  SystemEventMeta,
  SystemEventName,
  SystemEventPayloads,
  Unsubscribe,
} from './types'

// Schemas
export {
  ChatMessageSubmittedSchema,
  containsPII,
  CourseEnteredSchema,
  eventSchemas,
  LessonEndedSchema,
  LessonStartedSchema,
  PageViewedSchema,
  PdfViewedSchema,
  PII_FIELDS,
  RegistrationCompletedSchema,
  RegistrationPromptShownSchema,
  SessionStartedSchema,
  UserResolvedSchema,
} from './schemas'

// Event constants
export { SYSTEM_EVENTS } from './events'

// React hooks
export { useEmitSystemEvent, useSystemEvent, useSystemEventAny } from './hooks'
