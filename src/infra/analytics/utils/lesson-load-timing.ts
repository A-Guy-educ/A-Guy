/**
 * Lesson Load Timing Utilities
 *
 * Uses sessionStorage to pass the click timestamp from lesson link components
 * to the lesson page, allowing calculation of load_time_ms.
 */

const STORAGE_KEY = 'lesson_open_timestamp'

export interface LessonOpenTimestamp {
  lesson_id: string
  timestamp: number
}

/**
 * Store the timestamp when a user clicks to open a lesson.
 * Called from lesson link components (LessonCard, CourseLessonCard).
 */
export function storeLessonOpenTimestamp(lessonId: string): void {
  try {
    const data: LessonOpenTimestamp = {
      lesson_id: lessonId,
      timestamp: Date.now(),
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // sessionStorage may be unavailable (SSR, private browsing quota)
  }
}

/**
 * Retrieve and clear the stored timestamp.
 * Called from the lesson page to calculate load_time_ms.
 * Returns null if no timestamp is stored or if it's for a different lesson.
 */
export function consumeLessonOpenTimestamp(lessonId: string): number | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    sessionStorage.removeItem(STORAGE_KEY)

    const data: LessonOpenTimestamp = JSON.parse(raw)
    if (data.lesson_id !== lessonId) return null

    // Reject stale timestamps (older than 60 seconds)
    const age = Date.now() - data.timestamp
    if (age > 60_000) return null

    return data.timestamp
  } catch {
    return null
  }
}
