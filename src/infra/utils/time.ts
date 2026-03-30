/**
 * Time conversion utilities
 *
 * @fileType utility
 * @domain shared
 * @ai-summary Shared time unit conversion helpers
 */

const MS_PER_SECOND = 1_000
const MS_PER_MINUTE = 60 * MS_PER_SECOND
const MS_PER_HOUR = 60 * MS_PER_MINUTE
const MS_PER_DAY = 24 * MS_PER_HOUR

export function hoursToMs(hours: number): number {
  return hours * MS_PER_HOUR
}

export function daysToMs(days: number): number {
  return days * MS_PER_DAY
}
