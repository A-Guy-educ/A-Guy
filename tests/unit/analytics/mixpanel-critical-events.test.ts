/**
 * Mixpanel Critical Events - Unit Tests
 *
 * Tests for the 9 critical events added for issue #891:
 * - Coupon & Access: coupon_code_entered, access_gate_shown, access_granted
 * - Exercise Quality: answer_correct, answer_incorrect, exercise_skipped
 * - Engagement Signals: lesson_abandoned, chapter_completed, time_on_page
 */

import { describe, it, expect } from 'vitest'

import { SYSTEM_EVENTS } from '@/infra/system-events/events'
import { PRODUCT_EVENTS } from '@/infra/analytics/contracts/events'
import { eventDestinations } from '@/infra/analytics/contracts/destinations'
import {
  CouponCodeEnteredSchema,
  AccessGateShownSchema,
  AccessGrantedSchema,
  AnswerCorrectSchema,
  AnswerIncorrectSchema,
  ExerciseSkippedSchema,
  LessonAbandonedSchema,
  ChapterCompletedSchema,
  TimeOnPageSchema,
} from '@/infra/system-events/schemas'
import {
  CouponCodeEnteredPropertiesSchema,
  AccessGateShownPropertiesSchema,
  AccessGrantedPropertiesSchema,
  AnswerCorrectPropertiesSchema,
  AnswerIncorrectPropertiesSchema,
  ExerciseSkippedPropertiesSchema,
  LessonAbandonedPropertiesSchema,
  ChapterCompletedPropertiesSchema,
  TimeOnPagePropertiesSchema,
} from '@/infra/analytics/contracts/schemas'

describe('Mixpanel Critical Events - Constants', () => {
  it('should have all 9 system event constants', () => {
    expect(SYSTEM_EVENTS.COUPON_CODE_ENTERED).toBe('system.coupon_code_entered')
    expect(SYSTEM_EVENTS.ACCESS_GATE_SHOWN).toBe('system.access_gate_shown')
    expect(SYSTEM_EVENTS.ACCESS_GRANTED).toBe('system.access_granted')
    expect(SYSTEM_EVENTS.ANSWER_CORRECT).toBe('system.answer_correct')
    expect(SYSTEM_EVENTS.ANSWER_INCORRECT).toBe('system.answer_incorrect')
    expect(SYSTEM_EVENTS.EXERCISE_SKIPPED).toBe('system.exercise_skipped')
    expect(SYSTEM_EVENTS.LESSON_ABANDONED).toBe('system.lesson_abandoned')
    expect(SYSTEM_EVENTS.CHAPTER_COMPLETED).toBe('system.chapter_completed')
    expect(SYSTEM_EVENTS.TIME_ON_PAGE).toBe('system.time_on_page')
  })

  it('should have all 9 product event constants', () => {
    expect(PRODUCT_EVENTS.COUPON_CODE_ENTERED).toBe('coupon_code_entered')
    expect(PRODUCT_EVENTS.ACCESS_GATE_SHOWN).toBe('access_gate_shown')
    expect(PRODUCT_EVENTS.ACCESS_GRANTED).toBe('access_granted')
    expect(PRODUCT_EVENTS.ANSWER_CORRECT).toBe('answer_correct')
    expect(PRODUCT_EVENTS.ANSWER_INCORRECT).toBe('answer_incorrect')
    expect(PRODUCT_EVENTS.EXERCISE_SKIPPED).toBe('exercise_skipped')
    expect(PRODUCT_EVENTS.LESSON_ABANDONED).toBe('lesson_abandoned')
    expect(PRODUCT_EVENTS.CHAPTER_COMPLETED).toBe('chapter_completed')
    expect(PRODUCT_EVENTS.TIME_ON_PAGE).toBe('time_on_page')
  })
})

describe('Mixpanel Critical Events - Destination Routing', () => {
  const newEvents = [
    PRODUCT_EVENTS.COUPON_CODE_ENTERED,
    PRODUCT_EVENTS.ACCESS_GATE_SHOWN,
    PRODUCT_EVENTS.ACCESS_GRANTED,
    PRODUCT_EVENTS.ANSWER_CORRECT,
    PRODUCT_EVENTS.ANSWER_INCORRECT,
    PRODUCT_EVENTS.EXERCISE_SKIPPED,
    PRODUCT_EVENTS.LESSON_ABANDONED,
    PRODUCT_EVENTS.CHAPTER_COMPLETED,
    PRODUCT_EVENTS.TIME_ON_PAGE,
  ]

  it.each(newEvents)('should route %s to Mixpanel only', (event) => {
    expect(eventDestinations[event]).toEqual(['mixpanel'])
  })
})

describe('Mixpanel Critical Events - System Event Schemas', () => {
  describe('CouponCodeEnteredSchema', () => {
    it('should validate valid payload', () => {
      const result = CouponCodeEnteredSchema.safeParse({
        coupon_code: 'SUMMER2026',
        lesson_id: 'lesson_123',
        course_id: 'course_456',
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty coupon_code', () => {
      const result = CouponCodeEnteredSchema.safeParse({
        coupon_code: '',
        lesson_id: 'lesson_123',
        course_id: 'course_456',
      })
      expect(result.success).toBe(false)
    })

    it('should reject unknown fields (strict mode)', () => {
      const result = CouponCodeEnteredSchema.safeParse({
        coupon_code: 'SUMMER2026',
        lesson_id: 'lesson_123',
        course_id: 'course_456',
        extra_field: 'not allowed',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('AccessGateShownSchema', () => {
    it('should validate valid payload', () => {
      const result = AccessGateShownSchema.safeParse({
        gate_type: 'coupon',
        lesson_id: 'lesson_123',
        course_id: 'course_456',
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid gate_type', () => {
      const result = AccessGateShownSchema.safeParse({
        gate_type: 'invalid',
        lesson_id: 'lesson_123',
        course_id: 'course_456',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('AccessGrantedSchema', () => {
    it('should validate with optional coupon_code', () => {
      const result = AccessGrantedSchema.safeParse({
        access_type: 'free',
        lesson_id: 'lesson_123',
        course_id: 'course_456',
      })
      expect(result.success).toBe(true)
    })

    it('should validate with coupon_code', () => {
      const result = AccessGrantedSchema.safeParse({
        access_type: 'coupon',
        coupon_code: 'SUMMER2026',
        lesson_id: 'lesson_123',
        course_id: 'course_456',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('AnswerCorrectSchema', () => {
    it('should validate valid payload', () => {
      const result = AnswerCorrectSchema.safeParse({
        exercise_id: 'ex_123',
        lesson_id: 'lesson_456',
        time_seconds: 45,
        attempt_number: 1,
        difficulty_level: 'medium',
      })
      expect(result.success).toBe(true)
    })

    it('should reject negative time_seconds', () => {
      const result = AnswerCorrectSchema.safeParse({
        exercise_id: 'ex_123',
        lesson_id: 'lesson_456',
        time_seconds: -1,
        attempt_number: 1,
        difficulty_level: 'medium',
      })
      expect(result.success).toBe(false)
    })

    it('should reject zero attempt_number', () => {
      const result = AnswerCorrectSchema.safeParse({
        exercise_id: 'ex_123',
        lesson_id: 'lesson_456',
        time_seconds: 45,
        attempt_number: 0,
        difficulty_level: 'easy',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('AnswerIncorrectSchema', () => {
    it('should validate valid payload', () => {
      const result = AnswerIncorrectSchema.safeParse({
        exercise_id: 'ex_123',
        lesson_id: 'lesson_456',
        attempt_number: 2,
        max_attempts: 3,
        time_seconds: 30,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('ExerciseSkippedSchema', () => {
    it('should validate valid payload', () => {
      const result = ExerciseSkippedSchema.safeParse({
        exercise_id: 'ex_123',
        lesson_id: 'lesson_456',
        reason: 'too_difficult',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('LessonAbandonedSchema', () => {
    it('should validate valid payload', () => {
      const result = LessonAbandonedSchema.safeParse({
        lesson_id: 'lesson_123',
        course_id: 'course_456',
        time_spent_seconds: 120,
        progress_percent: 45,
        exercises_attempted: 3,
        exercises_completed: 1,
      })
      expect(result.success).toBe(true)
    })

    it('should reject progress_percent > 100', () => {
      const result = LessonAbandonedSchema.safeParse({
        lesson_id: 'lesson_123',
        course_id: 'course_456',
        time_spent_seconds: 120,
        progress_percent: 150,
        exercises_attempted: 3,
        exercises_completed: 1,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ChapterCompletedSchema', () => {
    it('should validate valid payload', () => {
      const result = ChapterCompletedSchema.safeParse({
        course_id: 'course_456',
        chapter_id: 'chapter_789',
        total_lessons: 5,
        completion_time_seconds: 3600,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('TimeOnPageSchema', () => {
    it('should validate valid payload', () => {
      const result = TimeOnPageSchema.safeParse({
        page_url: '/course/123/lesson/456',
        time_seconds: 60,
        scroll_depth_percent: 75,
        user_interacted: true,
      })
      expect(result.success).toBe(true)
    })

    it('should validate without optional scroll_depth_percent', () => {
      const result = TimeOnPageSchema.safeParse({
        page_url: '/course/123/lesson/456',
        time_seconds: 30,
        user_interacted: false,
      })
      expect(result.success).toBe(true)
    })
  })
})

describe('Mixpanel Critical Events - Analytics Property Schemas', () => {
  it('should validate CouponCodeEnteredPropertiesSchema', () => {
    const result = CouponCodeEnteredPropertiesSchema.safeParse({
      coupon_code: 'SUMMER2026',
      lesson_id: 'lesson_123',
      course_id: 'course_456',
    })
    expect(result.success).toBe(true)
  })

  it('should validate AccessGateShownPropertiesSchema', () => {
    const result = AccessGateShownPropertiesSchema.safeParse({
      gate_type: 'paid',
      lesson_id: 'lesson_123',
      course_id: 'course_456',
    })
    expect(result.success).toBe(true)
  })

  it('should validate AccessGrantedPropertiesSchema', () => {
    const result = AccessGrantedPropertiesSchema.safeParse({
      access_type: 'coupon',
      coupon_code: 'SUMMER2026',
      lesson_id: 'lesson_123',
      course_id: 'course_456',
    })
    expect(result.success).toBe(true)
  })

  it('should validate AnswerCorrectPropertiesSchema', () => {
    const result = AnswerCorrectPropertiesSchema.safeParse({
      exercise_id: 'ex_123',
      lesson_id: 'lesson_456',
      time_seconds: 45,
      attempt_number: 1,
      difficulty_level: 'medium',
    })
    expect(result.success).toBe(true)
  })

  it('should validate AnswerIncorrectPropertiesSchema', () => {
    const result = AnswerIncorrectPropertiesSchema.safeParse({
      exercise_id: 'ex_123',
      lesson_id: 'lesson_456',
      attempt_number: 2,
      max_attempts: 3,
      time_seconds: 30,
    })
    expect(result.success).toBe(true)
  })

  it('should validate ExerciseSkippedPropertiesSchema', () => {
    const result = ExerciseSkippedPropertiesSchema.safeParse({
      exercise_id: 'ex_123',
      lesson_id: 'lesson_456',
      reason: 'too_difficult',
    })
    expect(result.success).toBe(true)
  })

  it('should validate LessonAbandonedPropertiesSchema', () => {
    const result = LessonAbandonedPropertiesSchema.safeParse({
      lesson_id: 'lesson_123',
      course_id: 'course_456',
      time_spent_seconds: 120,
      progress_percent: 45,
      exercises_attempted: 3,
      exercises_completed: 1,
    })
    expect(result.success).toBe(true)
  })

  it('should validate ChapterCompletedPropertiesSchema', () => {
    const result = ChapterCompletedPropertiesSchema.safeParse({
      course_id: 'course_456',
      chapter_id: 'chapter_789',
      total_lessons: 5,
      completion_time_seconds: 3600,
    })
    expect(result.success).toBe(true)
  })

  it('should validate TimeOnPagePropertiesSchema', () => {
    const result = TimeOnPagePropertiesSchema.safeParse({
      page_url: '/course/123',
      time_seconds: 60,
      scroll_depth_percent: 50,
      user_interacted: true,
    })
    expect(result.success).toBe(true)
  })
})
