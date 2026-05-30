/**
 * Tiny date helpers used in place of `date-fns` for the study-plan code.
 * Only handles the cases we actually use (`yyyy-MM-dd` formatting,
 * start-of-day, ISO parsing, day arithmetic) — keep it that way.
 */

/** Format a Date as `yyyy-MM-dd` in local time. */
export function formatYmd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Return a new Date set to 00:00:00.000 local time of the given date. */
export function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

/** Parse an ISO date string (`yyyy-MM-dd` or full ISO) to a Date. */
export function parseISO(iso: string): Date {
  return new Date(iso)
}

/** Return a new Date that is `n` calendar days after `date` (handles DST). */
export function addDays(date: Date, n: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + n)
  return copy
}
