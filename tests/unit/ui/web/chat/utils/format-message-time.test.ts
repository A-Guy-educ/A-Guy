import { formatMessageTime } from '@/ui/web/chat/utils/formatMessageTime'
import { describe, expect, it } from 'vitest'

describe('formatMessageTime', () => {
  describe('today — time only', () => {
    it('returns HH:mm for a timestamp from today in English', () => {
      const now = new Date()
      const todayTs = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        14,
        32,
        0,
      ).toISOString()

      const result = formatMessageTime(todayTs, 'en')
      expect(result).toMatch(/^\d{2}:\d{2}$/)
    })

    it('returns HH:mm for a timestamp from today in Hebrew', () => {
      const now = new Date()
      const todayTs = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        9,
        5,
        0,
      ).toISOString()

      const result = formatMessageTime(todayTs, 'he')
      expect(result).toMatch(/^\d{2}:\d{2}$/)
    })
  })

  describe('older than today — short date + time', () => {
    it('returns "MMM D, HH:mm" for yesterday in English', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const ts = new Date(
        yesterday.getFullYear(),
        yesterday.getMonth(),
        yesterday.getDate(),
        18,
        45,
        0,
      ).toISOString()

      const result = formatMessageTime(ts, 'en')
      // e.g. "May 10, 18:45"
      expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{2}:\d{2}$/)
    })

    it('returns Hebrew date format for older messages in Hebrew', () => {
      const twoDaysAgo = new Date()
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
      const ts = new Date(
        twoDaysAgo.getFullYear(),
        twoDaysAgo.getMonth(),
        twoDaysAgo.getDate(),
        10,
        0,
        0,
      ).toISOString()

      const result = formatMessageTime(ts, 'he')
      // Hebrew format: "11 במאי, 10:00" — Hebrew month names contain Hebrew characters
      expect(result).toMatch(/במאי/)
      expect(result).toMatch(/\d{2}:\d{2}$/)
    })
  })

  describe('invalid input', () => {
    it('returns empty string for undefined', () => {
      expect(formatMessageTime(undefined, 'en')).toBe('')
    })

    it('returns empty string for null', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(formatMessageTime(null as any, 'en')).toBe('')
    })

    it('returns empty string for invalid date string', () => {
      expect(formatMessageTime('not-a-date', 'en')).toBe('')
    })

    it('returns empty string for empty string', () => {
      expect(formatMessageTime('', 'en')).toBe('')
    })
  })

  describe('locale fallback', () => {
    it('falls back to en-US for unknown locale', () => {
      const now = new Date()
      const todayTs = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        12,
        0,
        0,
      ).toISOString()

      const result = formatMessageTime(todayTs, 'fr')
      expect(result).toMatch(/^\d{2}:\d{2}$/)
    })
  })
})
