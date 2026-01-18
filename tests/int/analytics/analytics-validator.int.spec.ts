/**
 * Analytics Validator Integration Tests
 *
 * Tests event validation logic
 */

import { describe, it, expect } from 'vitest'
import { validateEvent } from '@/lib/analytics/core/validator'
import { PRODUCT_EVENTS } from '@/lib/analytics/contracts/events'

describe('Analytics Validator', () => {
  describe('Event Validation', () => {
    it('should validate a valid lesson_started event', () => {
      const result = validateEvent(PRODUCT_EVENTS.LESSON_STARTED, {
        lesson_id: '123',
        course_id: '456',
        lesson_title: 'Introduction',
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        lesson_id: '123',
        course_id: '456',
        lesson_title: 'Introduction',
      })
    })

    it('should validate a valid page_view event', () => {
      const result = validateEvent(PRODUCT_EVENTS.PAGE_VIEW, {
        page_path: '/course/123',
        page_title: 'Course Page',
      })

      expect(result.success).toBe(true)
      expect(result.data).toMatchObject({
        page_path: '/course/123',
        page_title: 'Course Page',
      })
    })

    it('should reject missing required properties', () => {
      // lesson_started requires lesson_id and course_id
      expect(() => {
        validateEvent(PRODUCT_EVENTS.LESSON_STARTED, {
          lesson_id: '123',
          // missing course_id
        })
      }).toThrow()
    })

    it('should accept events with only required properties', () => {
      const result = validateEvent(PRODUCT_EVENTS.LESSON_STARTED, {
        lesson_id: '123',
        course_id: '456',
        // lesson_title is optional
      })

      expect(result.success).toBe(true)
    })

    it('should reject unknown events in development', () => {
      expect(() => {
        validateEvent('unknown_event' as never, {})
      }).toThrow(/Unknown event/)
    })
  })

  describe('Config Guards', () => {
    it('should handle empty properties object', () => {
      const result = validateEvent(PRODUCT_EVENTS.SESSION_STARTED, {
        session_id: 'test-session',
        is_anonymous: true,
      })

      expect(result.success).toBe(true)
    })
  })
})
