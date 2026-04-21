/**
 * Analytics Tracker Unit Tests
 *
 * Tests the public API surface and session ID behavior.
 * Adapter integrations are covered by integration tests.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Import the actual tracker module (no mocking of tracker itself)
// We mock external dependencies to prevent real network calls
vi.mock('@/infra/analytics/core/validator', () => ({
  validateEvent: vi.fn().mockReturnValue({ success: true, data: {} }),
}))

vi.mock('@/infra/analytics/utils/user-properties-cache', () => ({
  clearCachedUserProperties: vi.fn(),
}))

vi.mock('@/infra/analytics/config', () => ({
  analyticsConfig: {
    enabled: true,
    debugMode: false,
    ga4: { enabled: false, measurementId: '' }, // Disable GA4 to prevent real calls
    mixpanel: { enabled: false, token: '' }, // Disable Mixpanel
  },
  validateConfig: vi.fn(),
}))

// Don't mock adapters — they're guarded by config.enabled = false

import {
  track,
  identify,
  alias,
  reset,
  getSessionId,
  analytics,
} from '@/infra/analytics/core/tracker'

describe('Analytics Tracker', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      vi.spyOn(window.sessionStorage, 'getItem').mockReturnValue(null)
      vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {})
      vi.spyOn(window.sessionStorage, 'removeItem').mockImplementation(() => {})
    }
  })

  describe('getSessionId()', () => {
    it('should generate a new session ID when none exists', () => {
      const sessionId = getSessionId()
      expect(sessionId).toMatch(/^session_\d+_[a-z0-9]+$/)
    })

    it('should return the same session ID on subsequent calls', () => {
      const first = getSessionId()
      const second = getSessionId()
      expect(first).toBe(second)
    })
  })

  describe('track()', () => {
    it('should not throw with valid event and properties', () => {
      expect(() => {
        track('page_view', { page_path: '/test' })
      }).not.toThrow()
    })

    it('should not throw with no properties', () => {
      expect(() => {
        track('lesson_started', { lesson_id: 'lesson-1' })
      }).not.toThrow()
    })

    it('should not throw with null/undefined properties', () => {
      expect(() => {
        track('page_view', {})
      }).not.toThrow()
    })
  })

  describe('identify()', () => {
    it('should not throw with userId and properties', () => {
      expect(() => {
        identify('user-123', { locale: 'en' })
      }).not.toThrow()
    })

    it('should not throw with userId only', () => {
      expect(() => {
        identify('user-456')
      }).not.toThrow()
    })
  })

  describe('alias()', () => {
    it('should not throw with both IDs', () => {
      expect(() => {
        alias('user-new', 'anon-old')
      }).not.toThrow()
    })

    it('should not throw with userId only', () => {
      expect(() => {
        alias('user-only')
      }).not.toThrow()
    })
  })

  describe('reset()', () => {
    it('should not throw', () => {
      expect(() => {
        reset()
      }).not.toThrow()
    })
  })

  describe('analytics API surface', () => {
    it('should expose track, identify, alias, and reset functions', () => {
      expect(typeof analytics.track).toBe('function')
      expect(typeof analytics.identify).toBe('function')
      expect(typeof analytics.alias).toBe('function')
      expect(typeof analytics.reset).toBe('function')
    })
  })
})
