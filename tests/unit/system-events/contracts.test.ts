/**
 * System Events - Schema Validation Tests
 *
 * Tests for Zod schema validation of all system events.
 */

import { describe, expect, it } from 'vitest'

import {
  ChatMessageSubmittedSchema,
  containsPII,
  CourseEnteredSchema,
  eventSchemas,
  LessonEndedSchema,
  LessonStartedSchema,
  PageViewedSchema,
  PdfViewedSchema,
  PII_FIELDS,
  RegistrationCompletedSchema,
  RegistrationPromptShownSchema,
  SessionStartedSchema,
  SiteInitSchema,
  UserResolvedSchema,
} from '@/infra/system-events/schemas'

import { SYSTEM_EVENTS } from '@/infra/system-events/events'

describe('Schema Validation', () => {
  describe('PageViewedSchema', () => {
    it('validates valid page view payload', () => {
      const payload = { page_path: '/courses' }
      const result = PageViewedSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })

    it('rejects missing page_path', () => {
      const payload = { page_title: 'Test' }
      const result = PageViewedSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })

    it('rejects unknown properties', () => {
      const payload = { page_path: '/courses', unknown_field: 'value' }
      const result = PageViewedSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })

    it('accepts optional fields', () => {
      const payload = {
        page_path: '/courses',
        page_title: 'Courses',
        page_search: 'math',
        locale: 'en',
      }
      const result = PageViewedSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })
  })

  describe('SessionStartedSchema', () => {
    it('validates valid session started payload', () => {
      const payload = { session_id: 'session_123', is_anonymous: true }
      const result = SessionStartedSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })

    it('rejects missing is_anonymous', () => {
      const payload = { session_id: 'session_123' }
      const result = SessionStartedSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })
  })

  describe('UserResolvedSchema', () => {
    it('validates valid user resolved payload', () => {
      const payload = { user_id: 'user_123', is_anonymous: false }
      const result = UserResolvedSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })

    it('rejects missing user_id', () => {
      const payload = { is_anonymous: false }
      const result = UserResolvedSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })
  })

  describe('CourseEnteredSchema', () => {
    it('validates valid course entered payload', () => {
      const payload = { course_id: 'course_123', course_title: 'Math 101' }
      const result = CourseEnteredSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })

    it('rejects missing course_id', () => {
      const payload = { course_title: 'Math 101' }
      const result = CourseEnteredSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })
  })

  describe('LessonStartedSchema', () => {
    it('validates valid lesson started payload', () => {
      const payload = {
        lesson_id: 'lesson_123',
        lesson_title: 'Introduction',
        course_id: 'course_123',
      }
      const result = LessonStartedSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })

    it('rejects missing lesson_id', () => {
      const payload = { lesson_title: 'Introduction' }
      const result = LessonStartedSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })
  })

  describe('LessonEndedSchema', () => {
    it('validates valid lesson ended payload', () => {
      const payload = { lesson_id: 'lesson_123', duration_seconds: 300 }
      const result = LessonEndedSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })

    it('accepts completion_percentage', () => {
      const payload = {
        lesson_id: 'lesson_123',
        duration_seconds: 300,
        completion_percentage: 75,
      }
      const result = LessonEndedSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })

    it('rejects completion_percentage > 100', () => {
      const payload = {
        lesson_id: 'lesson_123',
        duration_seconds: 300,
        completion_percentage: 150,
      }
      const result = LessonEndedSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })
  })

  describe('PdfViewedSchema', () => {
    it('validates valid PDF viewed payload with absolute URL', () => {
      const payload = {
        pdf_url: 'https://example.com/document.pdf',
        pdf_title: 'Document',
      }
      const result = PdfViewedSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })

    it('accepts Vercel Blob URL', () => {
      const payload = {
        pdf_url: 'https://pub-xxxxx.blob.vercel-storage.com/media/document.pdf',
      }
      const result = PdfViewedSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })

    it('accepts relative path starting with /api/media', () => {
      const payload = {
        pdf_url: '/api/media/file/document.pdf',
      }
      const result = PdfViewedSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })

    it('accepts relative path with encoded characters', () => {
      const payload = {
        pdf_url: '/api/media/file/Math%20-%205units%20-%20571.pdf',
      }
      const result = PdfViewedSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })

    it('rejects invalid URL (not a URL and not a relative path)', () => {
      const payload = { pdf_url: 'not-a-url' }
      const result = PdfViewedSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })

    it('rejects empty string', () => {
      const payload = { pdf_url: '' }
      const result = PdfViewedSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })

    it('rejects relative path not starting with /', () => {
      const payload = { pdf_url: 'api/media/file.pdf' }
      const result = PdfViewedSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })

    it('accepts optional page_number and duration', () => {
      const payload = {
        pdf_url: 'https://example.com/document.pdf',
        page_number: 5,
        duration_seconds: 120,
      }
      const result = PdfViewedSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })

    it('accepts optional page_count for document total pages', () => {
      const payload = {
        pdf_url: 'https://example.com/document.pdf',
        page_count: 42,
      }
      const result = PdfViewedSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })
  })

  describe('ChatMessageSubmittedSchema', () => {
    it('validates valid chat message payload', () => {
      const payload = {
        conversation_id: 'conv_123',
        message_type: 'user',
        message_length: 50,
      }
      const result = ChatMessageSubmittedSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })

    it('rejects invalid message_type', () => {
      const payload = {
        conversation_id: 'conv_123',
        message_type: 'invalid',
        message_length: 50,
      }
      const result = ChatMessageSubmittedSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })
  })

  describe('RegistrationPromptShownSchema', () => {
    it('validates valid registration prompt payload', () => {
      const payload = {
        prompt_location: 'lesson_page',
        trigger_type: 'exercise_limit',
      }
      const result = RegistrationPromptShownSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })

    it('rejects missing prompt_location', () => {
      const payload = { trigger_type: 'exercise_limit' }
      const result = RegistrationPromptShownSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })
  })

  describe('RegistrationCompletedSchema', () => {
    it('validates valid registration completed payload', () => {
      const payload = {
        user_id: 'user_123',
        auth_method: 'email',
      }
      const result = RegistrationCompletedSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })

    it('rejects invalid auth_method', () => {
      const payload = { user_id: 'user_123', auth_method: 'invalid' }
      const result = RegistrationCompletedSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })
  })
})

describe('Schema Registry', () => {
  it('contains all 23 system events', () => {
    const eventNames = Object.keys(eventSchemas)
    expect(eventNames.length).toBe(23)
  })

  it('maps each event name to its schema', () => {
    expect(eventSchemas[SYSTEM_EVENTS.SITE_INIT]).toBe(SiteInitSchema)
    expect(eventSchemas[SYSTEM_EVENTS.PAGE_VIEWED]).toBe(PageViewedSchema)
    expect(eventSchemas[SYSTEM_EVENTS.SESSION_STARTED]).toBe(SessionStartedSchema)
    expect(eventSchemas[SYSTEM_EVENTS.USER_RESOLVED]).toBe(UserResolvedSchema)
    expect(eventSchemas[SYSTEM_EVENTS.COURSE_ENTERED]).toBe(CourseEnteredSchema)
    expect(eventSchemas[SYSTEM_EVENTS.LESSON_STARTED]).toBe(LessonStartedSchema)
    expect(eventSchemas[SYSTEM_EVENTS.LESSON_ENDED]).toBe(LessonEndedSchema)
    expect(eventSchemas[SYSTEM_EVENTS.PDF_VIEWED]).toBe(PdfViewedSchema)
    expect(eventSchemas[SYSTEM_EVENTS.CHAT_MESSAGE_SUBMITTED]).toBe(ChatMessageSubmittedSchema)
    expect(eventSchemas[SYSTEM_EVENTS.REGISTRATION_PROMPT_SHOWN]).toBe(
      RegistrationPromptShownSchema,
    )
    expect(eventSchemas[SYSTEM_EVENTS.REGISTRATION_COMPLETED]).toBe(RegistrationCompletedSchema)
  })
})

describe('PII Detection', () => {
  it('detects PII fields in payload', () => {
    const payload = { page_path: '/courses', email: 'test@example.com', name: 'John' }
    const found = containsPII(payload)
    expect(found).toContain('email')
    expect(found).toContain('name')
    expect(found).not.toContain('page_path')
  })

  it('returns empty array when no PII present', () => {
    const payload = { page_path: '/courses', page_title: 'Test' }
    const found = containsPII(payload)
    expect(found).toEqual([])
  })

  it('defines PII_FIELDS correctly', () => {
    expect(PII_FIELDS).toEqual(['email', 'password', 'name', 'phone', 'address'])
  })
})
