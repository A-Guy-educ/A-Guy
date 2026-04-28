/**
 * Version of the cached InteractiveLesson payload shape stored in the
 * `interactive_lessons` collection.
 *
 * BUMP this value any time the cached lesson JSON shape changes in a way
 * that would break the client converter (`interactiveLessonToGuidedExplanation`)
 * or the runner. Older cached rows whose `cacheSchemaVersion` doesn't match
 * are evicted on read and regenerated against the new shape, so the client
 * never sees a payload its code can't handle.
 *
 * Examples of changes that warrant a bump:
 *   - Adding a required field to InteractiveLesson / InteractiveLessonStep
 *   - Renaming or removing an existing field the converter reads
 *   - Changing the encoding of a field (e.g. audioBase64 → audioUrl)
 *   - Adding a new scene-kind primitive that the converter would silently
 *     drop on older rows (acceptable to skip a bump if the converter is
 *     tolerant — but bumping is the safer default)
 *
 * Examples of changes that do NOT need a bump:
 *   - Adding a new optional field whose absence is a valid state
 *   - Changing the prompt template (covered by promptId/promptUpdatedAt)
 */
export const INTERACTIVE_LESSON_CACHE_SCHEMA_VERSION = 'v1'
