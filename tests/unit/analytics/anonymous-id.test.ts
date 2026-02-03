// @vitest-environment jsdom
/**
 * Anonymous ID Management Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  generateAnonymousId,
  getOrCreateAnonymousId,
  setAnonymousIdCookie,
  clearAnonymousIdCookie,
  ANONYMOUS_ID_COOKIE_NAME,
} from '@/infra/analytics/utils/anonymous-id'
import { getCookie, deleteCookie } from '@/infra/analytics/utils/cookies'

describe('Anonymous ID Management', () => {
  let originalCookieDescriptor: PropertyDescriptor | undefined

  beforeEach(() => {
    // Save original cookie descriptor
    originalCookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')

    // Clear cookies and localStorage
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0].trim()
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
    })
    localStorage.clear()
  })

  afterEach(() => {
    // Restore original cookie descriptor after EACH test
    if (originalCookieDescriptor) {
      Object.defineProperty(document, 'cookie', originalCookieDescriptor)
    }
  })

  describe('generateAnonymousId()', () => {
    it('should generate a UUID v4 format ID', () => {
      const id = generateAnonymousId()
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex =
        /^anon_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      expect(id).toMatch(uuidRegex)
    })

    it('should generate unique IDs on each call', () => {
      const id1 = generateAnonymousId()
      const id2 = generateAnonymousId()
      const id3 = generateAnonymousId()

      expect(id1).not.toBe(id2)
      expect(id2).not.toBe(id3)
      expect(id1).not.toBe(id3)
    })

    it('should prefix with "anon_" for easy identification', () => {
      const id = generateAnonymousId()
      expect(id).toMatch(/^anon_/)
    })
  })

  describe('getOrCreateAnonymousId()', () => {
    it('should return existing ID from cookie if present', () => {
      const existingId = 'anon_12345678-1234-4123-8123-123456789012'
      setAnonymousIdCookie(existingId)

      const id = getOrCreateAnonymousId()
      expect(id).toBe(existingId)
    })

    it('should generate and store new ID if cookie is missing', () => {
      const id = getOrCreateAnonymousId()

      expect(id).toMatch(/^anon_/)
      expect(getCookie(ANONYMOUS_ID_COOKIE_NAME)).toBe(id)
    })

    it('should handle cookie read errors gracefully', () => {
      // Simulate error by making getCookie throw
      Object.defineProperty(document, 'cookie', {
        get: () => {
          throw new Error('Cookie read error')
        },
        set: () => {
          // no-op
        },
        configurable: true,
      })

      const id = getOrCreateAnonymousId()
      expect(id).toMatch(/^anon_/)
    })

    it('should generate new ID if cookie value is invalid', () => {
      // Set invalid cookie value
      document.cookie = `${ANONYMOUS_ID_COOKIE_NAME}=invalid; path=/`

      const id = getOrCreateAnonymousId()
      expect(id).toMatch(
        /^anon_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
    })
  })

  describe('setAnonymousIdCookie()', () => {
    it('should set cookie with correct name "mp_anon_id"', () => {
      const id = 'anon_test'
      setAnonymousIdCookie(id)

      expect(getCookie(ANONYMOUS_ID_COOKIE_NAME)).toBe(id)
    })

    it('should set cookie with 1 year expiry', () => {
      let setCookieValue = ''
      Object.defineProperty(document, 'cookie', {
        get: () => setCookieValue,
        set: (value: string) => {
          setCookieValue = value
        },
        configurable: true,
      })

      setAnonymousIdCookie('anon_test')
      expect(setCookieValue).toContain('max-age=31536000') // 365 days
    })

    it('should set SameSite=Lax for cross-page navigation', () => {
      let setCookieValue = ''
      Object.defineProperty(document, 'cookie', {
        get: () => setCookieValue,
        set: (value: string) => {
          setCookieValue = value
        },
        configurable: true,
      })

      setAnonymousIdCookie('anon_test')
      expect(setCookieValue).toContain('SameSite=Lax')
    })

    it('should set Secure flag in production (when isSecure=true)', () => {
      let setCookieValue = ''
      Object.defineProperty(document, 'cookie', {
        get: () => setCookieValue,
        set: (value: string) => {
          setCookieValue = value
        },
        configurable: true,
      })

      setAnonymousIdCookie('anon_test', true)
      expect(setCookieValue).toContain('Secure')
    })
  })

  describe('clearAnonymousIdCookie()', () => {
    it('should remove the anonymous ID cookie', () => {
      setAnonymousIdCookie('anon_test')
      expect(getCookie(ANONYMOUS_ID_COOKIE_NAME)).toBe('anon_test')

      clearAnonymousIdCookie()
      expect(getCookie(ANONYMOUS_ID_COOKIE_NAME)).toBeNull()
    })

    it('should handle clearing non-existent cookie gracefully', () => {
      expect(() => clearAnonymousIdCookie()).not.toThrow()
    })
  })
})
