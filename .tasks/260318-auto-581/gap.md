# Gap Analysis: 260318-auto-581

## Summary

- **Gaps Found:** 8
- **Spec Revised:** Yes

## Gaps Found

### Gap 1: Missing System Event Constants for 9 New Events

**Severity:** Critical
**Location:** `src/infra/system-events/events.ts`
**Issue:** The `SYSTEM_EVENTS` enum does not have entries for the 9 new critical events:
- `COUPON_CODE_ENTERED` - User enters coupon code
- `ACCESS_GATE_SHOWN` - User encounters paywall/login gate
- `ACCESS_GRANTED` - User gains access
- `ANSWER_CORRECT` - User gets answer right on first attempt
- `ANSWER_INCORRECT` - User gets answer wrong
- `EXERCISE_SKIPPED` - User skips exercise without answering
- `LESSON_ABANDONED` - User leaves lesson incomplete
- `CHAPTER_COMPLETED` - User finishes all lessons in chapter
- `TIME_ON_PAGE` - Abandonment signal at time thresholds

**Fix Applied:** Added FR-ANALYTICS-01: Add SYSTEM_EVENTS constants and FR-ANALYTICS-02: Add system event Zod schemas for all 9 new events.

---

### Gap 2: Missing Product Event Constants

**Severity:** Critical
**Location:** `src/infra/analytics/contracts/events.ts`
**Issue:** `PRODUCT_EVENTS` enum only has 20 events. The 9 new critical events need to be added following the same naming pattern (`lowercase_with_underscores`).

**Fix Applied:** Added FR-ANALYTICS-03: Add PRODUCT_EVENTS for all 9 new events.

---

### Gap 3: Missing Analytics Property Schemas

**Severity:** Critical
**Location:** `src/infra/analytics/contracts/schemas.ts`
**Issue:** No Zod schemas exist for the 9 new events' properties. Each event needs specific fields per the task spec (e.g., `answer_correct` needs `exercise_id`, `lesson_id`, `time_seconds`, `attempt_number`, `difficulty_level`).

**Fix Applied:** Added FR-ANALYTICS-04: Add analytics property schemas with proper types and validation.

---

### Gap 4: Missing Event Destination Routing

**Severity:** Critical
**Location:** `src/infra/analytics/contracts/destinations.ts`
**Issue:** `eventDestinations` record has no entries for the 9 new events. Per existing pattern, most should route to `['mixpanel']` only (product analytics).

**Fix Applied:** Added FR-ANALYTICS-05: Add destination routing for new events (all to Mixpanel except where noted).

---

### Gap 5: Missing System Event Schema Definitions

**Severity:** High
**Location:** `src/infra/system-events/schemas.ts`
**Issue:** System event schemas (used for validating payloads before analytics tracking) don't exist for the 9 new events.

**Fix Applied:** Added FR-ANALYTICS-06: Add system event schemas in `src/infra/system-events/schemas.ts` and export payload types.

---

### Gap 6: Missing Analytics Subscriber Handlers

**Severity:** High
**Location:** `src/infra/analytics/system-events-subscriber.ts`
**Issue:** The `initAnalyticsSubscriber()` function has no handlers for the 9 new system events. Each new system event needs a `safeSubscribe()` call that maps the payload to the analytics track call.

**Fix Applied:** Added FR-ANALYTICS-07: Add subscriber handlers in `system-events-subscriber.ts`.

---

### Gap 7: Missing `difficulty_level` Field in Exercise Events

**Severity:** Medium
**Location:** `src/infra/system-events/exercise-schemas.ts`, `src/infra/analytics/contracts/schemas.ts`
**Issue:** The task spec requires `difficulty_level` (easy/medium/hard) for `answer_correct` and `answer_incorrect` events. The existing `ExerciseCompletedSchema` and related schemas don't include `difficulty_level`.

**Fix Applied:** Added FR-ANALYTICS-08: Ensure `difficulty_level` field is added to relevant exercise-related schemas.

---

### Gap 8: Missing `time_on_page` Event (Distinct from `tab_away`)

**Severity:** Medium
**Location:** `src/infra/analytics/hooks/usePageAbandonment.ts`
**Issue:** The task spec requests `time_on_page` event at specific time thresholds (30/60/120/300/600 seconds). The existing `usePageAbandonment.ts` only fires `TAB_AWAY` when the tab becomes hidden, not at time intervals. The `time_on_page` event requires additional logic to fire at threshold intervals regardless of tab visibility.

**Fix Applied:** Added FR-ANALYTICS-09: Implement `time_on_page` tracking at specified thresholds in `usePageAbandonment.ts` hook.

---

## Changes Made to Spec

### New Requirements Added to spec.md:

**FR-ANALYTICS-01: System Event Constants** (MUST)
Add 9 new system event constants in `src/infra/system-events/events.ts`:
- `COUPON_CODE_ENTERED`
- `ACCESS_GATE_SHOWN`
- `ACCESS_GRANTED`
- `ANSWER_CORRECT`
- `ANSWER_INCORRECT`
- `EXERCISE_SKIPPED`
- `LESSON_ABANDONED`
- `CHAPTER_COMPLETED`
- `TIME_ON_PAGE`

**FR-ANALYTICS-02: System Event Schemas** (MUST)
Add Zod schemas for all 9 new system events in `src/infra/system-events/schemas.ts`:
- Include proper field validation with `.strict()` mode
- Export `Payload` types for each

**FR-ANALYTICS-03: Product Event Constants** (MUST)
Add 9 new product events in `src/infra/analytics/contracts/events.ts` following `lowercase_with_underscores` naming.

**FR-ANALYTICS-04: Analytics Property Schemas** (MUST)
Add Zod schemas for all 9 new analytics events in `src/infra/analytics/contracts/schemas.ts`:
- `CouponCodeEnteredSchema`: email, name, coupon_code, lesson_id, course_id
- `AccessGateShownSchema`: gate_type, lesson_id, course_id
- `AccessGrantedSchema`: access_type, coupon_code, lesson_id, course_id
- `AnswerCorrectSchema`: exercise_id, lesson_id, time_seconds, attempt_number, difficulty_level
- `AnswerIncorrectSchema`: exercise_id, lesson_id, attempt_number, max_attempts, time_seconds
- `ExerciseSkippedSchema`: exercise_id, lesson_id, reason
- `LessonAbandonedSchema`: lesson_id, course_id, time_spent_seconds, progress_percent, exercises_attempted, exercises_completed
- `ChapterCompletedSchema`: course_id, chapter_id, total_lessons, completion_time_seconds
- `TimeOnPageSchema`: page_url, time_seconds, scroll_depth_percent, user_interacted

**FR-ANALYTICS-05: Event Destination Routing** (MUST)
Add routing entries in `src/infra/analytics/contracts/destinations.ts` for all 9 new events. All route to `['mixpanel']` (product analytics use case).

**FR-ANALYTICS-06: Schema Registry Updates** (MUST)
Add new schemas to the `eventSchemas` registry in both:
- `src/infra/system-events/schemas.ts`
- `src/infra/analytics/contracts/schemas.ts`

**FR-ANALYTICS-07: Analytics Subscriber Handlers** (MUST)
Add `safeSubscribe()` handlers in `src/infra/analytics/system-events-subscriber.ts` for all 9 new events.

**FR-ANALYTICS-08: Difficulty Level in Exercise Events** (MUST)
Add `difficulty_level` field to relevant schemas for `answer_correct` and `answer_incorrect` events.

**FR-ANALYTICS-09: Time on Page Threshold Tracking** (MUST)
Enhance `src/infra/analytics/hooks/usePageAbandonment.ts` to emit `time_on_page` event at 30/60/120/300/600 second thresholds (in addition to existing `tab_away` behavior).

---

### Updated Acceptance Criteria:

- [ ] All 9 new system events have constants in `SYSTEM_EVENTS`
- [ ] All 9 new system events have Zod schemas in `system-events/schemas.ts`
- [ ] All 9 new product events have constants in `PRODUCT_EVENTS`
- [ ] All 9 new product events have property schemas in `analytics/contracts/schemas.ts`
- [ ] All 9 new events have destination routing (all to Mixpanel)
- [ ] All 9 new events have subscriber handlers in `system-events-subscriber.ts`
- [ ] `difficulty_level` is included in answer_correct/answer_incorrect schemas
- [ ] `time_on_page` fires at 30/60/120/300/600 second thresholds
- [ ] New events can be filtered by all specified properties in Mixpanel

---

### New Guardrails:

- **Naming Convention**: All new events must follow `lowercase_with_underscores` pattern
- **No PII**: Events must NOT include raw email/name - only IDs. Email/name only in `user_identified` event
- **Schema Strictness**: All new schemas must use `.strict()` to reject unknown properties
- **Event Atomicity**: Each event maps to exactly one system event (no combining)

---

### Open Questions (from Gap Analysis):

1. **Where should `coupon_code_entered` event be emitted from?** The task spec doesn't identify the trigger location. Is it:
   - Client-side: When user types in coupon field and submits?
   - Server-side: When coupon API validates the code?

2. **Where should `access_gate_shown` and `access_granted` events be emitted from?** Need to identify the access gate component/code location.

3. **Where should `chapter_completed` be emitted?** Need to identify where chapter completion logic exists (likely when last lesson in chapter is completed).

4. **Is `exercise_skipped` possible?** Need to verify if users can skip exercises without answering in the current exercise renderer.

5. **Should `time_on_page` replace `tab_away` or coexist?** The existing `TAB_AWAY` event already captures some abandonment data. Clarify if these are separate events or if `time_on_page` supersedes `tab_away`.
