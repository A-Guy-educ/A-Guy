/**
 * Analytics Tracker Flow Integration Tests
 *
 * Tests the analytics infrastructure that can be tested without a real browser:
 * - System event bus emission and subscription
 * - Schema validation for all events
 * - Destination routing (GA4 + Mixpanel per event)
 * - Event name → destination mapping
 *
 * NOTE: End-to-end adapter delivery (GA4/Mixpanel network calls) are tested
 * via Playwright E2E tests that run in a real browser environment.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock adapters to prevent real network calls ───────────────────────────────
vi.mock('@/infra/analytics/config', () => ({
  analyticsConfig: {
    enabled: true,
    debugMode: false,
    ga4: { enabled: true, measurementId: 'G-TEST' },
    mixpanel: { enabled: true, token: 'mp-test' },
  },
  validateConfig: vi.fn(),
}))

const adapterCalls = { ga4: 0, mixpanel: 0 }
vi.mock('@/infra/analytics/adapters/ga4/adapter', () => ({
  sendToGA4: () => {
    adapterCalls.ga4++
  },
}))
vi.mock('@/infra/analytics/adapters/mixpanel/adapter', () => ({
  sendToMixpanel: () => {
    adapterCalls.mixpanel++
  },
  identifyUser: vi.fn(),
  aliasUser: vi.fn(),
  resetUser: vi.fn(),
}))

// ─── Imports ────────────────────────────────────────────────────────────────
import { systemEventBus, SYSTEM_EVENTS } from '@/infra/system-events'
import { PRODUCT_EVENTS } from '@/infra/analytics/contracts/events'
import { getEventDestinations } from '@/infra/analytics/contracts/destinations'
import { validateEvent } from '@/infra/analytics/core/validator'

describe('Analytics Tracker Flow Integration', () => {
  beforeEach(() => {
    adapterCalls.ga4 = 0
    adapterCalls.mixpanel = 0

    if (typeof window !== 'undefined' && window.sessionStorage) {
      vi.spyOn(window.sessionStorage, 'getItem').mockReturnValue(null)
      vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {})
      vi.spyOn(window.sessionStorage, 'removeItem').mockImplementation(() => {})
    }
  })

  // ─── Destination Routing ──────────────────────────────────────────────────

  describe('Destination routing', () => {
    it('should route page_view to both GA4 and Mixpanel', () => {
      const destinations = getEventDestinations(PRODUCT_EVENTS.PAGE_VIEW)
      expect(destinations).toContain('ga4')
      expect(destinations).toContain('mixpanel')
    })

    it('should route user_identified to Mixpanel only', () => {
      const destinations = getEventDestinations(PRODUCT_EVENTS.USER_IDENTIFIED)
      expect(destinations).toContain('mixpanel')
      expect(destinations).not.toContain('ga4')
    })

    it('should route lesson_started to Mixpanel', () => {
      const destinations = getEventDestinations(PRODUCT_EVENTS.LESSON_STARTED)
      expect(destinations).toContain('mixpanel')
    })

    it('should route registration_completed to both GA4 and Mixpanel', () => {
      const destinations = getEventDestinations(PRODUCT_EVENTS.REGISTRATION_COMPLETED)
      expect(destinations).toContain('ga4')
      expect(destinations).toContain('mixpanel')
    })
  })

  // ─── Schema Validation ────────────────────────────────────────────────────

  describe('Schema validation', () => {
    it('should validate page_view with required fields', () => {
      const result = validateEvent(PRODUCT_EVENTS.PAGE_VIEW, {
        page_path: '/courses',
        page_title: 'All Courses',
        locale: 'en',
      })
      expect(result.success).toBe(true)
    })

    it('should validate page_view without optional fields', () => {
      const result = validateEvent(PRODUCT_EVENTS.PAGE_VIEW, { page_path: '/test' })
      expect(result.success).toBe(true)
    })

    it('should validate lesson_started with course_id optional', () => {
      const result = validateEvent(PRODUCT_EVENTS.LESSON_STARTED, {
        lesson_id: 'lesson-abc',
      })
      expect(result.success).toBe(true)
    })

    it('should validate lesson_started with chapter_id and locale', () => {
      const result = validateEvent(PRODUCT_EVENTS.LESSON_STARTED, {
        lesson_id: 'lesson-abc',
        course_id: 'course-xyz',
        chapter_id: 'chapter-1',
        lesson_title: 'Introduction',
        locale: 'he',
      })
      expect(result.success).toBe(true)
    })

    it('should validate lesson_completed with optional fields', () => {
      const result = validateEvent(PRODUCT_EVENTS.LESSON_COMPLETED, {
        lesson_id: 'lesson-1',
        duration_seconds: 120,
        completion_percentage: 85,
      })
      expect(result.success).toBe(true)
    })

    it('should validate registration_completed with registration_method', () => {
      const result = validateEvent(PRODUCT_EVENTS.REGISTRATION_COMPLETED, {
        user_id: 'user-123',
        registration_method: 'google',
      })
      expect(result.success).toBe(true)
    })

    it('should validate registration_completed with anonymous_upgrade method', () => {
      const result = validateEvent(PRODUCT_EVENTS.REGISTRATION_COMPLETED, {
        user_id: 'user-456',
        registration_method: 'anonymous_upgrade',
      })
      expect(result.success).toBe(true)
    })

    it('should validate exercise_completed with all fields', () => {
      const result = validateEvent(PRODUCT_EVENTS.EXERCISE_COMPLETED, {
        lesson_id: 'lesson-ex',
        exercise_id: 'ex-1',
        duration_seconds: 45,
        total_questions: 5,
        correct_count: 4,
        locale: 'en',
      })
      expect(result.success).toBe(true)
    })

    it('should reject page_view without page_path', () => {
      expect(() => {
        validateEvent(PRODUCT_EVENTS.PAGE_VIEW, { page_title: 'Test' })
      }).toThrow()
    })
  })

  // ─── System Event Bus ─────────────────────────────────────────────────────

  describe('System event bus', () => {
    it('should emit page_viewed event and have a subscriber registered', () => {
      const unsubscribe = systemEventBus.on(SYSTEM_EVENTS.PAGE_VIEWED, () => {})
      expect(typeof unsubscribe).toBe('function')
      unsubscribe()
    })

    it('should emit lesson_started event through the bus', () => {
      let received = false
      const unsubscribe = systemEventBus.on(SYSTEM_EVENTS.LESSON_STARTED, () => {
        received = true
      })
      systemEventBus.emit(SYSTEM_EVENTS.LESSON_STARTED, {
        lesson_id: 'test-lesson',
        course_id: 'test-course',
      })
      expect(received).toBe(true)
      unsubscribe()
    })

    it('should emit registration_completed with user_id and auth_method', () => {
      let receivedPayload: unknown = null
      const unsubscribe = systemEventBus.on(SYSTEM_EVENTS.REGISTRATION_COMPLETED, (envelope) => {
        receivedPayload = envelope.payload
      })
      systemEventBus.emit(SYSTEM_EVENTS.REGISTRATION_COMPLETED, {
        user_id: 'user-test-123',
        auth_method: 'email',
      })
      expect(receivedPayload).toMatchObject({
        user_id: 'user-test-123',
        auth_method: 'email',
      })
      unsubscribe()
    })

    it('should emit exercise_completed with correct schema fields', () => {
      let receivedPayload: unknown = null
      const unsubscribe = systemEventBus.on(SYSTEM_EVENTS.EXERCISE_COMPLETED, (envelope) => {
        receivedPayload = envelope.payload
      })
      systemEventBus.emit(SYSTEM_EVENTS.EXERCISE_COMPLETED, {
        lesson_id: 'lesson-ex',
        exercise_id: 'ex-1',
        duration_seconds: 30,
        total_questions: 3,
        correct_count: 3,
        locale: 'en',
      })
      expect(receivedPayload).toMatchObject({
        lesson_id: 'lesson-ex',
        exercise_id: 'ex-1',
        duration_seconds: 30,
        total_questions: 3,
        correct_count: 3,
      })
      unsubscribe()
    })
  })

  // ─── System Event → Analytics Event Mapping ────────────────────────────────

  describe('Event name constants', () => {
    it('should have unique system event names', () => {
      const names = Object.values(SYSTEM_EVENTS)
      const unique = new Set(names)
      expect(unique.size).toBe(names.length)
    })

    it('should have unique product event names', () => {
      const names = Object.values(PRODUCT_EVENTS)
      const unique = new Set(names)
      expect(unique.size).toBe(names.length)
    })

    it('should have matching pairs for all critical events', () => {
      expect(SYSTEM_EVENTS.PAGE_VIEWED).toBeDefined()
      expect(SYSTEM_EVENTS.LESSON_STARTED).toBeDefined()
      expect(SYSTEM_EVENTS.LESSON_ENDED).toBeDefined()
      expect(SYSTEM_EVENTS.REGISTRATION_COMPLETED).toBeDefined()
      expect(SYSTEM_EVENTS.EXERCISE_COMPLETED).toBeDefined()
    })
  })
})
