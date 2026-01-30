/**
 * System Events - Bus Behavior Tests
 *
 * Tests for the event bus emit, subscribe, and unsubscribe functionality.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { systemEventBus } from '@/infra/system-events/bus'
import { SYSTEM_EVENTS } from '@/infra/system-events/events'

describe('Event Bus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('emit', () => {
    it('emits event to handlers', () => {
      const handler = vi.fn()
      systemEventBus.on(SYSTEM_EVENTS.PAGE_VIEWED, handler)

      systemEventBus.emit(SYSTEM_EVENTS.PAGE_VIEWED, { page_path: '/courses' })

      expect(handler).toHaveBeenCalledTimes(1)
      const envelope = handler.mock.calls[0][0]
      expect(envelope.name).toBe(SYSTEM_EVENTS.PAGE_VIEWED)
      expect(envelope.payload.page_path).toBe('/courses')
    })

    it('emits to multiple handlers for same event', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      systemEventBus.on(SYSTEM_EVENTS.PAGE_VIEWED, handler1)
      systemEventBus.on(SYSTEM_EVENTS.PAGE_VIEWED, handler2)

      systemEventBus.emit(SYSTEM_EVENTS.PAGE_VIEWED, { page_path: '/test' })

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })

    it('emits to any-handlers (catch-all)', () => {
      const anyHandler = vi.fn()

      systemEventBus.onAny(anyHandler)

      systemEventBus.emit(SYSTEM_EVENTS.PAGE_VIEWED, { page_path: '/test' })

      expect(anyHandler).toHaveBeenCalledTimes(1)
    })

    it('adds metadata to envelope', () => {
      const handler = vi.fn()
      systemEventBus.on(SYSTEM_EVENTS.PAGE_VIEWED, handler)

      systemEventBus.emit(SYSTEM_EVENTS.PAGE_VIEWED, { page_path: '/test' })

      const envelope = handler.mock.calls[0][0]
      expect(envelope.meta).toBeDefined()
      expect(envelope.meta.timestamp).toBeDefined()
      expect(envelope.meta.session_id).toBeDefined()
      expect(envelope.meta.bus_version).toBe('v0')
    })

    it('isolates handler errors - one handler error does not affect others', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error')
      })
      const normalHandler = vi.fn()

      systemEventBus.on(SYSTEM_EVENTS.PAGE_VIEWED, errorHandler)
      systemEventBus.on(SYSTEM_EVENTS.PAGE_VIEWED, normalHandler)

      // Should not throw
      expect(() => {
        systemEventBus.emit(SYSTEM_EVENTS.PAGE_VIEWED, { page_path: '/test' })
      }).not.toThrow()

      // Normal handler should still be called
      expect(normalHandler).toHaveBeenCalledTimes(1)
    })
  })

  describe('on', () => {
    it('returns unsubscribe function', () => {
      const handler = vi.fn()
      const unsubscribe = systemEventBus.on(SYSTEM_EVENTS.PAGE_VIEWED, handler)

      expect(typeof unsubscribe).toBe('function')

      unsubscribe()
      systemEventBus.emit(SYSTEM_EVENTS.PAGE_VIEWED, { page_path: '/test' })

      expect(handler).not.toHaveBeenCalled()
    })

    it('supports multiple subscriptions to same event', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      const unsub1 = systemEventBus.on(SYSTEM_EVENTS.PAGE_VIEWED, handler1)
      const unsub2 = systemEventBus.on(SYSTEM_EVENTS.PAGE_VIEWED, handler2)

      systemEventBus.emit(SYSTEM_EVENTS.PAGE_VIEWED, { page_path: '/test' })

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)

      // Unsubscribe one handler
      unsub1()
      systemEventBus.emit(SYSTEM_EVENTS.PAGE_VIEWED, { page_path: '/test2' })

      expect(handler1).toHaveBeenCalledTimes(1) // Still 1
      expect(handler2).toHaveBeenCalledTimes(2) // Called again
    })
  })

  describe('onAny', () => {
    it('receives all events', () => {
      const anyHandler = vi.fn()

      systemEventBus.onAny(anyHandler)

      systemEventBus.emit(SYSTEM_EVENTS.PAGE_VIEWED, { page_path: '/test1' })
      systemEventBus.emit(SYSTEM_EVENTS.SESSION_STARTED, { session_id: 's1', is_anonymous: true })
      systemEventBus.emit(SYSTEM_EVENTS.LESSON_STARTED, { lesson_id: 'l1' })

      expect(anyHandler).toHaveBeenCalledTimes(3)
    })

    it('returns unsubscribe function', () => {
      const handler = vi.fn()
      const unsubscribe = systemEventBus.onAny(handler)

      unsubscribe()
      systemEventBus.emit(SYSTEM_EVENTS.PAGE_VIEWED, { page_path: '/test' })

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('different event types', () => {
    it('handles all 10 event types', () => {
      const handler = vi.fn()

      // Subscribe to each event type
      systemEventBus.on(SYSTEM_EVENTS.PAGE_VIEWED, handler)
      systemEventBus.on(SYSTEM_EVENTS.SESSION_STARTED, handler)
      systemEventBus.on(SYSTEM_EVENTS.USER_RESOLVED, handler)
      systemEventBus.on(SYSTEM_EVENTS.COURSE_ENTERED, handler)
      systemEventBus.on(SYSTEM_EVENTS.LESSON_STARTED, handler)
      systemEventBus.on(SYSTEM_EVENTS.LESSON_ENDED, handler)
      systemEventBus.on(SYSTEM_EVENTS.PDF_VIEWED, handler)
      systemEventBus.on(SYSTEM_EVENTS.CHAT_MESSAGE_SUBMITTED, handler)
      systemEventBus.on(SYSTEM_EVENTS.REGISTRATION_PROMPT_SHOWN, handler)
      systemEventBus.on(SYSTEM_EVENTS.REGISTRATION_COMPLETED, handler)

      // Emit each event
      systemEventBus.emit(SYSTEM_EVENTS.PAGE_VIEWED, { page_path: '/p1' })
      systemEventBus.emit(SYSTEM_EVENTS.SESSION_STARTED, { session_id: 's1', is_anonymous: true })
      systemEventBus.emit(SYSTEM_EVENTS.USER_RESOLVED, { user_id: 'u1', is_anonymous: false })
      systemEventBus.emit(SYSTEM_EVENTS.COURSE_ENTERED, { course_id: 'c1' })
      systemEventBus.emit(SYSTEM_EVENTS.LESSON_STARTED, { lesson_id: 'l1' })
      systemEventBus.emit(SYSTEM_EVENTS.LESSON_ENDED, { lesson_id: 'l1', duration_seconds: 300 })
      systemEventBus.emit(SYSTEM_EVENTS.PDF_VIEWED, { pdf_url: 'https://example.com/file.pdf' })
      systemEventBus.emit(SYSTEM_EVENTS.CHAT_MESSAGE_SUBMITTED, {
        conversation_id: 'conv1',
        message_type: 'user',
        message_length: 50,
      })
      systemEventBus.emit(SYSTEM_EVENTS.REGISTRATION_PROMPT_SHOWN, { prompt_location: 'lesson' })
      systemEventBus.emit(SYSTEM_EVENTS.REGISTRATION_COMPLETED, {
        user_id: 'u2',
        registration_method: 'email',
      })

      expect(handler).toHaveBeenCalledTimes(10)
    })
  })
})
