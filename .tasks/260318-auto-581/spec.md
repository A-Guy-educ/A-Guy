# Mixpanel Analytics - Critical Events Specification

## Overview

Add 9 CRITICAL Mixpanel analytics events for coupon tracking, exercise quality, and engagement signals. This requires updates to the system event bus, analytics schemas, product event constants, and analytics subscriber.

## Requirements

### FR-ANALYTICS-01: System Event Constants (MUST)

Add 9 new system event constants in `src/infra/system-events/events.ts`:
- `COUPON_CODE_ENTERED` = 'system.coupon_code_entered'
- `ACCESS_GATE_SHOWN` = 'system.access_gate_shown'
- `ACCESS_GRANTED` = 'system.access_granted'
- `ANSWER_CORRECT` = 'system.answer_correct'
- `ANSWER_INCORRECT` = 'system.answer_incorrect'
- `EXERCISE_SKIPPED` = 'system.exercise_skipped'
- `LESSON_ABANDONED` = 'system.lesson_abandoned'
- `CHAPTER_COMPLETED` = 'system.chapter_completed'
- `TIME_ON_PAGE` = 'system.time_on_page'

### FR-ANALYTICS-02: System Event Schemas (MUST)

Add Zod schemas for all 9 new system events in `src/infra/system-events/schemas.ts`:

1. **CouponCodeEnteredSchema**
   - coupon_code: string (required)
   - lesson_id: string (required)
   - course_id: string (required)

2. **AccessGateShownSchema**
   - gate_type: enum ['free', 'login', 'paid', 'coupon']
   - lesson_id: string (required)
   - course_id: string (required)

3. **AccessGrantedSchema**
   - access_type: enum ['free', 'coupon', 'paid']
   - coupon_code: string (optional)
   - lesson_id: string (required)
   - course_id: string (required)

4. **AnswerCorrectSchema**
   - exercise_id: string (required)
   - lesson_id: string (required)
   - time_seconds: number (required)
   - attempt_number: number (required)
   - difficulty_level: enum ['easy', 'medium', 'hard']

5. **AnswerIncorrectSchema**
   - exercise_id: string (required)
   - lesson_id: string (required)
   - attempt_number: number (required)
   - max_attempts: number (required)
   - time_seconds: number (required)

6. **ExerciseSkippedSchema**
   - exercise_id: string (required)
   - lesson_id: string (required)
   - reason: string (required)

7. **LessonAbandonedSchema**
   - lesson_id: string (required)
   - course_id: string (required)
   - time_spent_seconds: number (required)
   - progress_percent: number (required)
   - exercises_attempted: number (required)
   - exercises_completed: number (required)

8. **ChapterCompletedSchema**
   - course_id: string (required)
   - chapter_id: string (required)
   - total_lessons: number (required)
   - completion_time_seconds: number (required)

9. **TimeOnPageSchema**
   - page_url: string (required)
   - time_seconds: number (required)
   - scroll_depth_percent: number (optional)
   - user_interacted: boolean (required)

All schemas must use `.strict()` mode.

### FR-ANALYTICS-03: Product Event Constants (MUST)

Add 9 new product events in `src/infra/analytics/contracts/events.ts`:
- `COUPON_CODE_ENTERED`: 'coupon_code_entered'
- `ACCESS_GATE_SHOWN`: 'access_gate_shown'
- `ACCESS_GRANTED`: 'access_granted'
- `ANSWER_CORRECT`: 'answer_correct'
- `ANSWER_INCORRECT`: 'answer_incorrect'
- `EXERCISE_SKIPPED`: 'exercise_skipped'
- `LESSON_ABANDONED`: 'lesson_abandoned'
- `CHAPTER_COMPLETED`: 'chapter_completed'
- `TIME_ON_PAGE`: 'time_on_page'

### FR-ANALYTICS-04: Analytics Property Schemas (MUST)

Add Zod schemas in `src/infra/analytics/contracts/schemas.ts` with property names matching the task specification exactly (lowercase_with_underscores).

### FR-ANALYTICS-05: Event Destination Routing (MUST)

Add routing entries in `src/infra/analytics/contracts/destinations.ts`. All 9 new events route to `['mixpanel']` only (product analytics use case).

### FR-ANALYTICS-06: Analytics Subscriber Handlers (MUST)

Add `safeSubscribe()` handlers in `src/infra/analytics/system-events-subscriber.ts` for all 9 new events following the existing pattern.

### FR-ANALYTICS-07: Difficulty Level in Exercise Events (MUST)

Add `difficulty_level` field (easy/medium/hard) to relevant exercise schemas.

### FR-ANALYTICS-08: Time on Page Threshold Tracking (MUST)

Enhance `src/infra/analytics/hooks/usePageAbandonment.ts` to emit `time_on_page` event at 30/60/120/300/600 second thresholds.

### FR-ANALYTICS-09: Exercise Answer Correctness Tracking (MUST)

Implement separate `answer_correct` and `answer_incorrect` events triggered on first attempt (not derived from existing `student_answer_submitted`).

## Acceptance Criteria

- [ ] All 9 new system events have constants in `SYSTEM_EVENTS`
- [ ] All 9 new system events have Zod schemas in `system-events/schemas.ts`
- [ ] All 9 new product events have constants in `PRODUCT_EVENTS`
- [ ] All 9 new product events have property schemas in `analytics/contracts/schemas.ts`
- [ ] All 9 new events have destination routing (all to Mixpanel)
- [ ] All 9 new events have subscriber handlers in `system-events-subscriber.ts`
- [ ] `difficulty_level` is included in answer_correct/answer_incorrect schemas
- [ ] `time_on_page` fires at 30/60/120/300/600 second thresholds
- [ ] New events can be filtered by all specified properties in Mixpanel
- [ ] All events include user_id (when logged in) and session_id
- [ ] All events follow lowercase_with_underscores naming convention

## Guardrails

- **Naming Convention**: All new events must follow `lowercase_with_underscores` pattern
- **No PII**: Events must NOT include raw email/name - only IDs. Email/name only in `user_identified` event
- **Schema Strictness**: All new schemas must use `.strict()` to reject unknown properties
- **Event Atomicity**: Each event maps to exactly one system event (no combining)
- **Consistent IDs**: All IDs (user_id, lesson_id, course_id, exercise_id) must be consistent and traceable
- **Transaction Safety**: When emitting events from hooks, pass `req` to nested operations

## Out of Scope

- Modifying existing 20 events
- GA4 integration for new events (Mixpanel only)
- Adding the 8 recommended events (content + learning + registration)
- Adding the 7 optional events (monetization + discovery)
- Pre-built Mixpanel tables/reports (configuration in Mixpanel dashboard)
- Testing in Mixpanel dashboard (manual QA step)

## Implementation Pattern

Following the existing pattern in `src/infra/analytics/`:

1. Add system event constant to `SYSTEM_EVENTS` in `src/infra/system-events/events.ts`
2. Add system event schema to `src/infra/system-events/schemas.ts`
3. Add product event constant to `PRODUCT_EVENTS` in `src/infra/analytics/contracts/events.ts`
4. Add analytics property schema to `src/infra/analytics/contracts/schemas.ts`
5. Add destination routing to `eventDestinations` in `src/infra/analytics/contracts/destinations.ts`
6. Add subscriber handler in `src/infra/analytics/system-events-subscriber.ts`
7. Emit the event from the appropriate component/service using `systemEventBus.emit()`
