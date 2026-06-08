/**
 * Format a message timestamp for display in a chat bubble.
 *
 * - Same calendar day as today: "14:32" (en) or "14:32" (he — uses Gregorian calendar)
 * - Older: "May 11, 14:32" (en) or "11 במאי, 14:32" (he)
 *
 * @param timestamp - ISO 8601 string (e.g. from new Date().toISOString())
 * @param locale - IETF BCP 47 locale tag, e.g. "en" or "he"
 * @returns Formatted time string, or empty string if timestamp is invalid
 */
export function formatMessageTime(timestamp: string | undefined, locale: string): string {
  if (!timestamp) return ''

  const date = new Date(timestamp)
  if (isNaN(date.getTime())) return ''

  const now = new Date()

  // Compare calendar dates using local time (same day = today)
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false, // Always 24-hour for consistency; matches "14:32" style in issue
  }

  if (isToday) {
    return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-US', timeOptions).format(date)
  }

  const fullOptions: Intl.DateTimeFormatOptions = {
    ...timeOptions,
    month: 'short', // "May" / "במאי"
    day: 'numeric',
  }

  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-US', fullOptions).format(date)
}
