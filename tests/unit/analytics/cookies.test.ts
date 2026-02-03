// @vitest-environment jsdom
/**
 * Cookie Utilities Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getCookie, setCookie, deleteCookie } from '@/infra/analytics/utils/cookies'

describe('Cookie Utilities', () => {
  let originalCookieDescriptor: PropertyDescriptor | undefined

  beforeEach(() => {
    // Save original cookie descriptor
    originalCookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')

    // Clear all cookies before each test
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0].trim()
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
    })
  })

  afterEach(() => {
    // Restore original cookie descriptor
    if (originalCookieDescriptor) {
      Object.defineProperty(Document.prototype, 'cookie', originalCookieDescriptor)
    }
  })

  describe('getCookie()', () => {
    it('should return value when cookie exists', () => {
      document.cookie = 'test_cookie=test_value; path=/'
      const value = getCookie('test_cookie')
      expect(value).toBe('test_value')
    })

    it('should return null when cookie does not exist', () => {
      const value = getCookie('nonexistent_cookie')
      expect(value).toBeNull()
    })

    it('should parse cookie with special characters correctly', () => {
      // URL-encoded value
      document.cookie = 'special_cookie=hello%20world; path=/'
      const value = getCookie('special_cookie')
      expect(value).toBe('hello%20world')
    })

    it('should handle multiple cookies correctly', () => {
      document.cookie = 'cookie1=value1; path=/'
      document.cookie = 'cookie2=value2; path=/'
      document.cookie = 'cookie3=value3; path=/'

      expect(getCookie('cookie1')).toBe('value1')
      expect(getCookie('cookie2')).toBe('value2')
      expect(getCookie('cookie3')).toBe('value3')
    })
  })

  describe('setCookie()', () => {
    it('should set cookie with correct name and value', () => {
      setCookie('test_cookie', 'test_value')
      expect(getCookie('test_cookie')).toBe('test_value')
    })

    it('should set cookie with 1 year expiry by default', () => {
      let setCookieValue = ''
      Object.defineProperty(document, 'cookie', {
        get: () => setCookieValue,
        set: (value: string) => {
          setCookieValue = value
        },
        configurable: true,
      })

      setCookie('test_cookie', 'test_value')
      expect(setCookieValue).toContain('max-age=31536000') // 365 days in seconds
    })

    it('should set SameSite=Lax attribute', () => {
      let setCookieValue = ''
      Object.defineProperty(document, 'cookie', {
        get: () => setCookieValue,
        set: (value: string) => {
          setCookieValue = value
        },
        configurable: true,
      })

      setCookie('test_cookie', 'test_value')
      expect(setCookieValue).toContain('SameSite=Lax')
    })

    it('should set Secure flag when isSecure is true', () => {
      // Mock Object.defineProperty to spy on cookie setter
      let setCookieValue = ''
      Object.defineProperty(document, 'cookie', {
        get: () => setCookieValue,
        set: (value: string) => {
          setCookieValue = value
        },
        configurable: true,
      })

      setCookie('test_cookie', 'test_value', { isSecure: true })
      expect(setCookieValue).toContain('Secure')
    })

    it('should NOT set Secure flag when isSecure is false', () => {
      let setCookieValue = ''
      Object.defineProperty(document, 'cookie', {
        get: () => setCookieValue,
        set: (value: string) => {
          setCookieValue = value
        },
        configurable: true,
      })

      setCookie('test_cookie', 'test_value', { isSecure: false })
      expect(setCookieValue).not.toContain('Secure')
    })

    it('should allow custom expiry days', () => {
      let setCookieValue = ''
      Object.defineProperty(document, 'cookie', {
        get: () => setCookieValue,
        set: (value: string) => {
          setCookieValue = value
        },
        configurable: true,
      })

      setCookie('test_cookie', 'test_value', { expiryDays: 7 })
      expect(setCookieValue).toContain('max-age=604800') // 7 days in seconds
    })
  })

  describe('deleteCookie()', () => {
    it('should remove cookie by setting max-age to 0', () => {
      setCookie('test_cookie', 'test_value')
      expect(getCookie('test_cookie')).toBe('test_value')

      deleteCookie('test_cookie')
      expect(getCookie('test_cookie')).toBeNull()
    })

    it('should handle deleting non-existent cookie gracefully', () => {
      expect(() => deleteCookie('nonexistent_cookie')).not.toThrow()
    })
  })
})
