# Mixpanel Analytics - 9 Critical Events Implementation Plan

## Rerun Context

Previous run completed initial planning. This plan has been updated based on gap analysis findings. Changes from previous plan:
- Added FR-ANALYTICS-09 for time_on_page threshold tracking
- Added clarity on existing tab_away event relationship
- Refined exercise correctness tracking (answer_correct/answer_incorrect separate from student_answer_submitted)

## Research Findings

### File Paths Verified ✅
- `src/infra/system-events/events.ts` ✅ exists (69 lines)
- `src/infra/system-events/schemas.ts` ✅ exists (275 lines)
- `src/infra/analytics/contracts/events.ts` ✅ exists (70 lines)
- `src/infra/analytics/contracts/schemas.ts` ✅ exists (398 lines)
- `src/infra/analytics/contracts/destinations.ts` ✅ exists (80 lines)
- `src/infra/analytics/system-events-subscriber.ts` ✅ exists (398 lines)
- `src/infra/analytics/hooks/usePageAbandonment.ts` ✅ exists (77 lines)

### Patterns Observed
- System events use `system.` namespace prefix (e.g., `SYSTEM_EVENTS.LESSON_STARTED = 'system.lesson_started'`)
- Product events use `lowercase_with_underscores` format (e.g., `'lesson_started'`)
- All schemas use `.strict()` mode
- Subscriber uses `safeSubscribe()` wrapper with error isolation
- Analytics schemas export both schema and `z.infer<typeof Schema>` type
- Destination routing: most events go to `['mixpanel']` only

### Integration Points
- New events must be registered in: `events.ts` (constants), `schemas.ts` (both system and analytics), `destinations.ts`, and `system-events-subscriber.ts`
- `usePageAbandonment.ts` hook needs enhancement for time_on_page thresholds

## Reuse Inventory

- **No new utilities needed** - all required patterns already exist in codebase
- Existing `safeSubscribe()` helper from `system-events-subscriber.ts` - reuse
- Existing `.strict()` schema pattern - reuse
- Existing `PRODUCT_EVENTS` enum pattern - reuse
- Existing `eventDestinations` record pattern - reuse
- Existing `usePageAbandonment.ts` hook pattern - extend

---

## Step 1: Add System Event Constants

**Files to Touch:**
- `src/infra/system-events/events.ts` (MODIFIED - lines 11-64)

**Behavior:**
Add 9 new constants to `SYSTEM_EVENTS` enum following existing pattern:
- `COUPON_CODE_ENTERED: 'system.coupon_code_entered'`
- `ACCESS_GATE_SHOWN: 'system.access_gate_shown'`
- `ACCESS_GRANTED: 'system.access_granted'`
- `ANSWER_CORRECT: 'system.answer_correct'`
- `ANSWER_INCORRECT: 'system.answer_incorrect'`
- `EXERCISE_SKIPPED: 'system.exercise_skipped'`
- `LESSON_ABANDONED: 'system.lesson_abandoned'`
- `CHAPTER_COMPLETED: 'system.chapter_completed'`
- `TIME_ON_PAGE: 'system.time_on_page'`

**Test:**
```typescript
// tests/unit/analytics/new-events.test.ts
import { SYSTEM_EVENTS } from '@/infra/system-events'
it('should have all 9 new system event constants', () => {
  expect(SYSTEM_EVENTS.COUPON_CODE_ENTERED).toBe('system.coupon_code_entered')
  expect(SYSTEM_EVENTS.ACCESS_GATE_SHOWN).toBe('system.access_gate_shown')
  expect(SYSTEM_EVENTS.ANSWER_CORRECT).toBe('system.answer_correct')
  // ... etc
})
```

**Acceptance Criteria:**
- All 9 new constants exist in `SYSTEM_EVENTS`
- All follow `system.` namespace prefix pattern
- `SystemEventName` type union updates automatically

---

## Step 2: Add System Event Schemas

**Files to Touch:**
- `src/infra/system-events/schemas.ts` (MODIFIED - after line 209)

**Behavior:**
Add 9 new Zod schemas with `.strict()` mode:

1. **CouponCodeEnteredSchema**
```typescript
export const CouponCodeEnteredSchema = z.object({
  coupon_code: z.string().min(1),
  lesson_id: z.string().min(1),
  course_id: z.string().min(1),
}).strict()
```

2. **AccessGateShownSchema**
```typescript
export const AccessGateShownSchema = z.object({
  gate_type: z.enum(['free', 'login', 'paid', 'coupon']),
  lesson_id: z.string().min(1),
  course_id: z.string().min(1),
}).strict()
```

3. **AccessGrantedSchema**
```typescript
export const AccessGrantedSchema = z.object({
  access_type: z.enum(['free', 'coupon', 'paid']),
  coupon_code: z.string().optional(),
  lesson_id: z.string().min(1),
  course_id: z.string().min(1),
}).strict()
```

4. **AnswerCorrectSchema**
```typescript
export const AnswerCorrectSchema = z.object({
  exercise_id: z.string().min(1),
  lesson_id: z.string().min(1),
  time_seconds: z.number(),
  attempt_number: z.number().int().positive(),
  difficulty_level: z.enum(['easy', 'medium', 'hard']),
}).strict()
```

5. **AnswerIncorrectSchema**
```typescript
export const AnswerIncorrectSchema = z.object({
  exercise_id: z.string().min(1),
  lesson_id: z.string().min(1),
  attempt_number: z.number().int().positive(),
  max_attempts: z.number().int().positive(),
  time_seconds: z.number(),
}).strict()
```

6. **ExerciseSkippedSchema**
```typescript
export const ExerciseSkippedSchema = z.object({
  exercise_id: z.string().min(1),
  lesson_id: z.string().min(1),
  reason: z.string().min(1),
}).strict()
```

7. **LessonAbandonedSchema**
```typescript
export const LessonAbandonedSchema = z.object({
  lesson_id: z.string().min(1),
  course_id: z.string().min(1),
  time_spent_seconds: z.number(),
  progress_percent: z.number(),
  exercises_attempted: z.number().int().nonnegative(),
  exercises_completed: z.number().int().nonnegative(),
}).strict()
```

8. **ChapterCompletedSchema**
```typescript
export const ChapterCompletedSchema = z.object({
  course_id: z.string().min(1),
  chapter_id: z.string().min(1),
  total_lessons: z.number().int().positive(),
  completion_time_seconds: z.number(),
}).strict()
```

9. **TimeOnPageSchema**
```typescript
export const TimeOnPageSchema = z.object({
  page_url: z.string().min(1),
  time_seconds: z.number(),
  scroll_depth_percent: z.number().optional(),
  user_interacted: z.boolean(),
}).strict()
```

Also add each to `eventSchemas` registry and export Payload types.

**Test:**
```typescript
import { CouponCodeEnteredSchema, AccessGateShownSchema, AnswerCorrectSchema } from '@/infra/system-events/schemas'
it('should validate CouponCodeEnteredSchema', () => {
  const result = CouponCodeEnteredSchema.safeParse({
    coupon_code: 'SUMMER2026',
    lesson_id: 'lesson_123',
    course_id: 'course_456',
  })
  expect(result.success).toBe(true)
})
```

**Acceptance Criteria:**
- All 9 schemas exist with correct field types
- All use `.strict()` mode
- All exported Payload types work correctly
- All added to `eventSchemas` registry

---

## Step 3: Add Product Event Constants

**Files to Touch:**
- `src/infra/analytics/contracts/events.ts` (MODIFIED - after line 52)

**Behavior:**
Add 9 new entries to `PRODUCT_EVENTS`:
```typescript
// Coupon & Access Events
COUPON_CODE_ENTERED: 'coupon_code_entered',
ACCESS_GATE_SHOWN: 'access_gate_shown',
ACCESS_GRANTED: 'access_granted',

// Exercise Quality Events  
ANSWER_CORRECT: 'answer_correct',
ANSWER_INCORRECT: 'answer_incorrect',
EXERCISE_SKIPPED: 'exercise_skipped',

// Engagement Signal Events
LESSON_ABANDONED: 'lesson_abandoned',
CHAPTER_COMPLETED: 'chapter_completed',
TIME_ON_PAGE: 'time_on_page',
```

**Test:**
```typescript
import { PRODUCT_EVENTS } from '@/infra/analytics/contracts/events'
it('should have answer_correct event', () => {
  expect(PRODUCT_EVENTS.ANSWER_CORRECT).toBe('answer_correct')
})
```

**Acceptance Criteria:**
- All 9 new constants exist in `PRODUCT_EVENTS`
- All follow `lowercase_with_underscores` pattern

---

## Step 4: Add Analytics Property Schemas

**Files to Touch:**
- `src/infra/analytics/contracts/schemas.ts` (MODIFIED - after line 310)

**Behavior:**
Add 9 new Zod schemas matching the system event schemas but with analytics-specific field naming:

1. **CouponCodeEnteredPropertiesSchema** - same fields as CouponCodeEnteredSchema
2. **AccessGateShownPropertiesSchema** - same fields as AccessGateShownSchema
3. **AccessGrantedPropertiesSchema** - same fields as AccessGrantedSchema
4. **AnswerCorrectPropertiesSchema** - same fields as AnswerCorrectSchema
5. **AnswerIncorrectPropertiesSchema** - same fields as AnswerIncorrectSchema
6. **ExerciseSkippedPropertiesSchema** - same fields as ExerciseSkippedSchema
7. **LessonAbandonedPropertiesSchema** - same fields as LessonAbandonedSchema
8. **ChapterCompletedPropertiesSchema** - same fields as ChapterCompletedSchema
9. **TimeOnPagePropertiesSchema** - same fields as TimeOnPageSchema

Add all to `eventSchemas` registry (lines 315-341) and export all `*Properties` types.

**Test:**
```typescript
import { AnswerCorrectPropertiesSchema } from '@/infra/analytics/contracts/schemas'
it('should validate answer_correct with difficulty_level', () => {
  const result = AnswerCorrectPropertiesSchema.safeParse({
    exercise_id: 'ex_123',
    lesson_id: 'lesson_456',
    time_seconds: 45,
    attempt_number: 1,
    difficulty_level: 'medium',
  })
  expect(result.success).toBe(true)
})
```

**Acceptance Criteria:**
- All 9 schemas exist with correct field types
- All exported `*Properties` types work correctly
- All added to `eventSchemas` registry

---

## Step 5: Add Destination Routing

**Files to Touch:**
- `src/infra/analytics/contracts/destinations.ts` (MODIFIED - after line 58)

**Behavior:**
Add 9 new entries to `eventDestinations`:
```typescript
// Coupon & Access Events (Mixpanel only)
[PRODUCT_EVENTS.COUPON_CODE_ENTERED]: ['mixpanel'],
[PRODUCT_EVENTS.ACCESS_GATE_SHOWN]: ['mixpanel'],
[PRODUCT_EVENTS.ACCESS_GRANTED]: ['mixpanel'],

// Exercise Quality Events (Mixpanel only)
[PRODUCT_EVENTS.ANSWER_CORRECT]: ['mixpanel'],
[PRODUCT_EVENTS.ANSWER_INCORRECT]: ['mixpanel'],
[PRODUCT_EVENTS.EXERCISE_SKIPPED]: ['mixpanel'],

// Engagement Signal Events (Mixpanel only)
[PRODUCT_EVENTS.LESSON_ABANDONED]: ['mixpanel'],
[PRODUCT_EVENTS.CHAPTER_COMPLETED]: ['mixpanel'],
[PRODUCT_EVENTS.TIME_ON_PAGE]: ['mixpanel'],
```

**Test:**
```typescript
import { shouldSendToMixpanel } from '@/infra/analytics/contracts/destinations'
it('should route answer_correct to Mixpanel only', () => {
  expect(shouldSendToMixpanel(PRODUCT_EVENTS.ANSWER_CORRECT)).toBe(true)
  expect(shouldSendToGA4(PRODUCT_EVENTS.ANSWER_CORRECT)).toBe(false)
})
```

**Acceptance Criteria:**
- All 9 new events route to `['mixpanel']` only
- Helper functions work correctly

---

## Step 6: Add Analytics Subscriber Handlers

**Files to Touch:**
- `src/infra/analytics/system-events-subscriber.ts` (MODIFIED - after line 379)

**Behavior:**
Add 9 new `safeSubscribe()` handlers following existing pattern:
```typescript
// Coupon & Access
safeSubscribe(SYSTEM_EVENTS.COUPON_CODE_ENTERED, (envelope) => {
  const payload = envelope.payload as {
    coupon_code?: string
    lesson_id?: string
    course_id?: string
  }
  analytics.track(PRODUCT_EVENTS.COUPON_CODE_ENTERED, {
    coupon_code: payload.coupon_code,
    lesson_id: payload.lesson_id,
    course_id: payload.course_id,
  })
}),

safeSubscribe(SYSTEM_EVENTS.ACCESS_GATE_SHOWN, (envelope) => {
  const payload = envelope.payload as {
    gate_type?: 'free' | 'login' | 'paid' | 'coupon'
    lesson_id?: string
    course_id?: string
  }
  analytics.track(PRODUCT_EVENTS.ACCESS_GATE_SHOWN, {
    gate_type: payload.gate_type,
    lesson_id: payload.lesson_id,
    course_id: payload.course_id,
  })
}),

safeSubscribe(SYSTEM_EVENTS.ACCESS_GRANTED, (envelope) => {
  const payload = envelope.payload as {
    access_type?: 'free' | 'coupon' | 'paid'
    coupon_code?: string
    lesson_id?: string
    course_id?: string
  }
  analytics.track(PRODUCT_EVENTS.ACCESS_GRANTED, {
    access_type: payload.access_type,
    coupon_code: payload.coupon_code,
    lesson_id: payload.lesson_id,
    course_id: payload.course_id,
  })
}),

// Exercise Quality
safeSubscribe(SYSTEM_EVENTS.ANSWER_CORRECT, (envelope) => {
  const payload = envelope.payload as {
    exercise_id?: string
    lesson_id?: string
    time_seconds?: number
    attempt_number?: number
    difficulty_level?: 'easy' | 'medium' | 'hard'
  }
  analytics.track(PRODUCT_EVENTS.ANSWER_CORRECT, {
    exercise_id: payload.exercise_id,
    lesson_id: payload.lesson_id,
    time_seconds: payload.time_seconds,
    attempt_number: payload.attempt_number,
    difficulty_level: payload.difficulty_level,
  })
}),

safeSubscribe(SYSTEM_EVENTS.ANSWER_INCORRECT, (envelope) => {
  const payload = envelope.payload as {
    exercise_id?: string
    lesson_id?: string
    attempt_number?: number
    max_attempts?: number
    time_seconds?: number
  }
  analytics.track(PRODUCT_EVENTS.ANSWER_INCORRECT, {
    exercise_id: payload.exercise_id,
    lesson_id: payload.lesson_id,
    attempt_number: payload.attempt_number,
    max_attempts: payload.max_attempts,
    time_seconds: payload.time_seconds,
  })
}),

safeSubscribe(SYSTEM_EVENTS.EXERCISE_SKIPPED, (envelope) => {
  const payload = envelope.payload as {
    exercise_id?: string
    lesson_id?: string
    reason?: string
  }
  analytics.track(PRODUCT_EVENTS.EXERCISE_SKIPPED, {
    exercise_id: payload.exercise_id,
    lesson_id: payload.lesson_id,
    reason: payload.reason,
  })
}),

// Engagement Signals
safeSubscribe(SYSTEM_EVENTS.LESSON_ABANDONED, (envelope) => {
  const payload = envelope.payload as {
    lesson_id?: string
    course_id?: string
    time_spent_seconds?: number
    progress_percent?: number
    exercises_attempted?: number
    exercises_completed?: number
  }
  analytics.track(PRODUCT_EVENTS.LESSON_ABANDONED, {
    lesson_id: payload.lesson_id,
    course_id: payload.course_id,
    time_spent_seconds: payload.time_spent_seconds,
    progress_percent: payload.progress_percent,
    exercises_attempted: payload.exercises_attempted,
    exercises_completed: payload.exercises_completed,
  })
}),

safeSubscribe(SYSTEM_EVENTS.CHAPTER_COMPLETED, (envelope) => {
  const payload = envelope.payload as {
    course_id?: string
    chapter_id?: string
    total_lessons?: number
    completion_time_seconds?: number
  }
  analytics.track(PRODUCT_EVENTS.CHAPTER_COMPLETED, {
    course_id: payload.course_id,
    chapter_id: payload.chapter_id,
    total_lessons: payload.total_lessons,
    completion_time_seconds: payload.completion_time_seconds,
  })
}),

safeSubscribe(SYSTEM_EVENTS.TIME_ON_PAGE, (envelope) => {
  const payload = envelope.payload as {
    page_url?: string
    time_seconds?: number
    scroll_depth_percent?: number
    user_interacted?: boolean
  }
  analytics.track(PRODUCT_EVENTS.TIME_ON_PAGE, {
    page_url: payload.page_url,
    time_seconds: payload.time_seconds,
    scroll_depth_percent: payload.scroll_depth_percent,
    user_interacted: payload.user_interacted,
  })
}),
```

**Test:**
```typescript
// tests/unit/analytics/subscriber.test.ts
import { initAnalyticsSubscriber } from '@/infra/analytics/system-events-subscriber'
import { systemEventBus, SYSTEM_EVENTS } from '@/infra/system-events'

it('should subscribe to all new system events', () => {
  const cleanup = initAnalyticsSubscriber()
  
  // Verify handlers don't throw when events are emitted
  expect(() => {
    systemEventBus.emit(SYSTEM_EVENTS.ANSWER_CORRECT, {
      exercise_id: 'ex_123',
      lesson_id: 'lesson_456',
      time_seconds: 30,
      attempt_number: 1,
      difficulty_level: 'medium',
    })
  }).not.toThrow()
  
  cleanup()
})
```

**Acceptance Criteria:**
- All 9 new handlers are subscribed
- Handlers follow existing `safeSubscribe` pattern
- No errors thrown on event emission

---

## Step 7: Add Time-on-Page Threshold Tracking

**Files to Touch:**
- `src/infra/analytics/hooks/usePageAbandonment.ts` (MODIFIED - lines 19-77)

**Behavior:**
Enhance `usePageAbandonment` hook to emit `time_on_page` event at thresholds (30/60/120/300/600 seconds). This is separate from `tab_away`/`tab_back` which track tab visibility.

Add a new effect that sets up a timer to fire at each threshold:
```typescript
const TIME_THRESHOLDS = [30, 60, 120, 300, 600]

useEffect(() => {
  // Existing visibility/scroll tracking code...
  
  // New: Time threshold tracking
  const thresholds = new Set(TIME_THRESHOLDS)
  let lastFiredThreshold = 0
  
  const checkTimeThreshold = () => {
    const timeOnPage = Math.floor((Date.now() - pageStartTime.current) / 1000)
    
    for (const threshold of TIME_THRESHOLDS) {
      if (timeOnPage >= threshold && lastFiredThreshold < threshold) {
        analytics.track(PRODUCT_EVENTS.TIME_ON_PAGE, {
          page_url: pathname,
          time_seconds: threshold,
          scroll_depth_percent: maxScroll.current,
          user_interacted: maxScroll.current > 0,
        })
        lastFiredThreshold = threshold
      }
    }
  }
  
  const intervalId = setInterval(checkTimeThreshold, 1000)
  
  return () => clearInterval(intervalId)
}, [pathname])
```

**Test:**
```typescript
// tests/unit/analytics/hooks/usePageAbandonment.test.ts
it('should emit time_on_page at 30 second threshold', async () => {
  // Mock Date.now to advance time
  vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(30000)
  
  const trackSpy = vi.spyOn(analytics, 'track')
  
  renderHook(() => usePageAbandonment())
  
  // Advance timer to trigger 30s threshold
  vi.advanceTimersByTime(31000)
  
  expect(trackSpy).toHaveBeenCalledWith(
    PRODUCT_EVENTS.TIME_ON_PAGE,
    expect.objectContaining({
      time_seconds: 30,
    })
  )
})
```

**Acceptance Criteria:**
- `time_on_page` fires at 30, 60, 120, 300, 600 second thresholds
- Event includes `page_url`, `time_seconds`, `scroll_depth_percent`, `user_interacted`
- Only fires once per threshold per page visit
- Existing `tab_away`/`tab_back` behavior unchanged

---

## Summary

| Step | Files Modified | Key Changes |
|------|---------------|-------------|
| 1 | `events.ts` (system) | +9 constants |
| 2 | `schemas.ts` (system) | +9 schemas + types |
| 3 | `events.ts` (analytics) | +9 constants |
| 4 | `schemas.ts` (analytics) | +9 schemas + types |
| 5 | `destinations.ts` | +9 routing entries |
| 6 | `system-events-subscriber.ts` | +9 handlers |
| 7 | `usePageAbandonment.ts` | +threshold tracking |

**Total Files:** 7
**Total Lines Added:** ~300-400 lines across all files
**Test Files to Create:** 1 (`tests/unit/analytics/new-events.test.ts`)
