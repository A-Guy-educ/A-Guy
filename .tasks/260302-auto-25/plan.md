# Plan: Exam-Anchored Manual Study Plan Generation

**Task ID**: 260302-auto-25
**Type**: implement_feature
**Created**: 2026-03-02

## Rerun Context

This is a rerun with no specific code-level feedback (just `/cody rerun`). The previous run did not produce a plan.md. This is a fresh plan generation.

## Assumptions

1. **Source of exam date**: The exam date is provided by the user in the UI (text input, `YYYY-MM-DD`), stored in `StudyPlanSnapshot.examDate`. No separate "exam" collection exists.
2. **Timezone**: All date calculations use `YYYY-MM-DD` text strings (no timezone drift). "Today" is derived server-side using `startOfDay(new Date())` formatted as `YYYY-MM-DD`.
3. **Eligibility**: Users can generate a plan at any time (even before the 7-day window), but the plan window is always anchored to the exam date (D-6..D0).
4. **Regeneration policy**: Regeneration overwrites the existing plan for the same `owner + courseId`. A confirmation prompt is shown in the UI.
5. **Uniqueness model**: One active plan per `(userId, gradeLevel, courseId)` — same as current behavior.
6. **Plan persistence**: Plans are stored as structured day-by-day JSON in the `studyPlans` array field on `UserProgress`.
7. **Rate limiting**: Simple in-memory cooldown per user (10-second debounce) rather than full Redis-based rate limiting, given the app scale.
8. **HTTP method**: Generation will use `POST /api/study-plan/generate` (new route) per NFR-001 requirement for POST on state-changing operations. Existing `PUT` route for toggleStatus/editDay remains.

## Overview of Changes

The current engine generates a 7-day window anchored to **today**. The spec requires anchoring to the **exam date** (D-6..D0). Additionally, auto-regeneration on topic/date changes must be removed — generation happens only on explicit button click.

### Key Changes:
1. **Engine**: Change `generateStudyPlan` to anchor window to exam date (D-6..D0) with partial-window support
2. **API**: Create `POST /api/study-plan/generate` with exam-date validation, past-date rejection, rate limiting
3. **UI**: Remove auto-regeneration effect, add explicit generate/regenerate buttons, add error display
4. **Types**: Add `windowStart`/`windowEnd`/`status` fields to `StudyPlanSnapshot`
5. **i18n**: Add new translation keys for errors, regenerate button, status messages
6. **Collection schema**: Add `windowStart`, `windowEnd`, `status` fields to `studyPlans` array

---

## Step 1: Update Types and Engine — Exam-Anchored Window (D-6..D0)

**Time estimate**: 20 minutes

**Spec refs**: FR-004, FR-005, FR-009

### Files to Touch

- `src/lib/study-plan/types.ts` (MODIFIED — lines 24-37)
- `src/lib/study-plan/engine.ts` (MODIFIED — lines 220-254)
- `tests/unit/lib/study-plan/engine.spec.ts` (MODIFIED — add new tests)

### Exact Behavior

**`types.ts` changes:**
- Add to `StudyPlanSnapshot`: `windowStart: string` (YYYY-MM-DD), `windowEnd: string` (YYYY-MM-DD), `status: 'idle' | 'generating' | 'generated' | 'failed'`, `lastError?: string`
- Update `GeneratePlanInput`: keep `today` (used for partial-window clipping), keep `examDate`

**`engine.ts` changes:**
- `generateStudyPlan(input)` → Compute `windowEnd = examDate`, `windowStart = max(today, examDate - 6 days)`
- Generate days from `windowStart` to `windowEnd` (inclusive), i.e., 1-7 days depending on partial window
- Activity template selection: use `daysUntilExam = differenceInCalendarDays(examDate, today)` for `getTimeframeMode`
- Activity template: use first N entries of template where N = number of days in window
- If `examDate < today`, throw an error (callers handle)
- Return `{ days, windowStart, windowEnd }` — change return type to `{ days: StudyPlanDay[], windowStart: string, windowEnd: string }`

### Tests (FAIL before, PASS after)

**File**: `tests/unit/lib/study-plan/engine.spec.ts`

1. **Test: "Exam-anchored window — full 7 days when exam >= 7 days away"**
   - Input: `today='2026-03-01'`, `examDate='2026-03-20'`
   - Expected: `windowStart='2026-03-14'`, `windowEnd='2026-03-20'`, 7 days from 03-14 to 03-20
   - FAILS before: current engine generates days starting from `today` (03-01), not from exam-6

2. **Test: "Partial window — exam 3 days away clips to today"**
   - Input: `today='2026-03-18'`, `examDate='2026-03-20'`
   - Expected: `windowStart='2026-03-18'` (today, since 03-14 < today), `windowEnd='2026-03-20'`, 3 days
   - FAILS before: current engine always generates 7 days starting from today

3. **Test: "Exam date in the past — throws error"**
   - Input: `today='2026-03-20'`, `examDate='2026-03-19'`
   - Expected: throws error with message containing "past"
   - FAILS before: current engine doesn't validate this

4. **Test: "Exam is today — generates 1 day"**
   - Input: `today='2026-03-20'`, `examDate='2026-03-20'`
   - Expected: `windowStart='2026-03-20'`, `windowEnd='2026-03-20'`, exactly 1 day

### Acceptance Criteria

- [ ] `generateStudyPlan` returns `{ days, windowStart, windowEnd }` (not just `StudyPlanDay[]`)
- [ ] Window is anchored to exam date: `windowEnd = examDate`, `windowStart = max(today, examDate - 6)`
- [ ] Days span from `windowStart` to `windowEnd` inclusive (1-7 days)
- [ ] Exam date in the past throws an error
- [ ] Existing unit tests still pass (update assertions for new return shape)

---

## Step 2: Update Collection Schema — Add Window and Status Fields

**Time estimate**: 10 minutes

**Spec refs**: FR-005, FR-010

### Files to Touch

- `src/server/payload/collections/UserProgress.ts` (MODIFIED — lines 123-170, add fields to studyPlans array)
- `src/server/repos/queries/userProgress.ts` (MODIFIED — update `StudyPlanSnapshot` interface, lines 30-36)

### Exact Behavior

Add to the `studyPlans` array fields in `UserProgress`:
- `{ name: 'windowStart', type: 'text' }` — YYYY-MM-DD
- `{ name: 'windowEnd', type: 'text' }` — YYYY-MM-DD
- `{ name: 'status', type: 'select', options: ['idle', 'generating', 'generated', 'failed'], defaultValue: 'idle' }`
- `{ name: 'lastError', type: 'text', admin: { description: 'Last error message (redacted for non-admins)' } }`

Update the mirrored `StudyPlanSnapshot` interface in `userProgress.ts` to include `windowStart`, `windowEnd`, `status`.

### Tests (FAIL before, PASS after)

**File**: `tests/unit/lib/study-plan/schema.spec.ts` (NEW)

1. **Test: "StudyPlanSnapshot type includes windowStart, windowEnd, status"**
   - Import `StudyPlanSnapshot` type from `@/lib/study-plan/types`
   - Create an object literal with `windowStart`, `windowEnd`, `status: 'generated'`
   - TypeScript compilation check: if missing fields, this test file won't compile
   - FAILS before: types don't include these fields

### Acceptance Criteria

- [ ] `UserProgress` collection schema includes `windowStart`, `windowEnd`, `status`, `lastError` in `studyPlans` array
- [ ] `StudyPlanSnapshot` type in `types.ts` includes `windowStart`, `windowEnd`, `status`
- [ ] Mirrored types in `userProgress.ts` are updated
- [ ] `pnpm tsc --noEmit` passes

---

## Step 3: Create POST Generation Endpoint with Validation and Rate Limiting

**Time estimate**: 30 minutes

**Spec refs**: FR-002, FR-006, FR-009, NFR-001, NFR-002, FR-008

### Files to Touch

- `src/app/api/study-plan/generate/route.ts` (NEW)
- `src/lib/study-plan/rate-limiter.ts` (NEW)
- `tests/unit/api/study-plan-generate.spec.ts` (NEW)

### Exact Behavior

**`route.ts` — `POST /api/study-plan/generate`:**
1. Authenticate via `payload.auth({ headers })` → 401 if no user
2. Parse + validate body with Zod:
   ```
   { courseId: string, examDate: string (YYYY-MM-DD), topics: TopicInput[], gradeLevel: string }
   ```
3. Validate exam date:
   - Missing → 400 `{ error: 'studyPlan.error.noExamDate' }`
   - Invalid format → 400 `{ error: 'studyPlan.error.invalidExamDate' }`
   - In the past → 400 `{ error: 'studyPlan.error.examDatePast' }`
4. Validate topics:
   - Empty array → 400 `{ error: 'studyPlan.error.noTopics' }`
5. Rate limit check (per userId, 10-second cooldown):
   - If within cooldown → 429 `{ error: 'studyPlan.error.rateLimited' }`
6. Compute `today = format(startOfDay(new Date()), 'yyyy-MM-dd')`
7. Call `generateStudyPlan({ today, examDate, topics, idGenerator: nanoid })`
8. Build `StudyPlanSnapshot` with `windowStart`, `windowEnd`, `status: 'generated'`, `generatedAt`
9. Upsert into `UserProgress.studyPlans` array (find by `courseId`, replace or push)
10. Return `{ success: true, data: newPlan }`

**`rate-limiter.ts`:**
- Simple in-memory `Map<string, number>` tracking `userId → lastGenerationTimestamp`
- `canGenerate(userId): boolean` — returns false if last generation was < 10 seconds ago
- `recordGeneration(userId): void` — updates timestamp
- Exported for testing

**Error responses must NOT leak internal details** (no stack traces, no raw Zod errors to client).

### Tests (FAIL before, PASS after)

**File**: `tests/unit/api/study-plan-generate.spec.ts`

1. **Test: "POST /api/study-plan/generate — validates exam date in the past"**
   - Mock payload.auth → valid user
   - Send body with `examDate` = yesterday
   - Expected: 400 response with `error: 'studyPlan.error.examDatePast'`
   - FAILS before: route doesn't exist

2. **Test: "POST /api/study-plan/generate — validates missing exam date"**
   - Send body without `examDate`
   - Expected: 400 response with error about missing exam date
   - FAILS before: route doesn't exist

3. **Test: "Rate limiter — blocks rapid requests"**
   - Call `canGenerate('user1')` → true
   - Call `recordGeneration('user1')`
   - Call `canGenerate('user1')` immediately → false
   - Wait 10s (mock timer) → true
   - FAILS before: rate limiter doesn't exist

4. **Test: "Unauthenticated request returns 401"**
   - Mock payload.auth → no user
   - Expected: 401

### Acceptance Criteria

- [ ] `POST /api/study-plan/generate` exists and returns correct responses
- [ ] Unauthenticated → 401
- [ ] Missing/invalid exam date → 400 with i18n error key
- [ ] Exam date in past → 400 with `examDatePast` error
- [ ] Empty topics → 400 with `noTopics` error
- [ ] Rate limited → 429
- [ ] Successful generation → 200 with plan data including `windowStart`, `windowEnd`, `status: 'generated'`
- [ ] Plan is upserted (not duplicated) for same `courseId`
- [ ] Owner is derived from `req.user` (never from client body)

---

## Step 4: Remove Auto-Regeneration and Wire Manual Trigger in UI

**Time estimate**: 25 minutes

**Spec refs**: FR-001, FR-003, FR-007

### Files to Touch

- `src/app/(frontend)/study-plan/_components/useStudyPlan.ts` (MODIFIED — lines 1-184)
- `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx` (MODIFIED — lines 60-254)
- `src/app/(frontend)/study-plan/_components/EmptyPlanState.tsx` (MODIFIED — lines 1-16)

### Exact Behavior

**`useStudyPlan.ts` changes:**
- Change `generatePlan` to call `POST /api/study-plan/generate` instead of `PUT /api/study-plan` with action `generate`
- Add `isGenerating` state (separate from `isLoading`)
- Add `generationError` state for generation-specific errors
- Keep fetch-on-mount behavior (just reads existing plan — this is NOT auto-generation)
- Return `{ plan, isLoading, isGenerating, error, generationError, generatePlan, toggleDayStatus, editDay, hasPlan }`

**`StudyPlanPage.tsx` changes:**
- **Remove** the auto-regeneration `useEffect` (lines 117-127) — this is the key FR-003 change
- **Remove** `pendingRegeneration` ref
- Show "Generate study plan" button when no plan exists
- Show "Regenerate" button when plan exists (secondary style, with warning)
- Display `generationError` inline near the button
- Show `plan.windowStart` → `plan.windowEnd` date range in the schedule header
- Disable generate button when `isGenerating` is true (shows spinner)
- After successful generation, plan state updates automatically (no manual reload needed)

**`EmptyPlanState.tsx` changes:**
- No major changes, just ensure it renders correctly

### Tests (FAIL before, PASS after)

**File**: `tests/unit/study-plan-ui/useStudyPlan.spec.ts` (NEW — unit test for hook logic)

1. **Test: "generatePlan calls POST /api/study-plan/generate"**
   - Mock fetch
   - Call `generatePlan(examDate, topics, courseId)`
   - Assert fetch was called with `POST`, `/api/study-plan/generate`, correct body
   - FAILS before: hook calls `PUT /api/study-plan` with `action: 'generate'`

2. **Test: "No auto-regeneration on topic or date change"**
   - Verify that changing topics/examDate does NOT trigger fetch
   - Only explicit `generatePlan` call triggers API call
   - FAILS before: auto-regeneration useEffect fires on changes

### Acceptance Criteria

- [ ] Auto-regeneration useEffect is removed
- [ ] Changing topics or exam date does NOT trigger generation
- [ ] "Generate" button calls POST endpoint
- [ ] Loading/error states displayed correctly
- [ ] "Regenerate" button visible when plan already exists
- [ ] `pendingRegeneration` ref is removed

---

## Step 5: Add i18n Keys for New Error Messages and UI States

**Time estimate**: 10 minutes

**Spec refs**: FR-009

### Files to Touch

- `src/i18n/en.json` (MODIFIED — add keys under `studyPlan`)
- `src/i18n/he.json` (MODIFIED — add keys under `studyPlan`)

### Exact Behavior

Add to `studyPlan` in both locale files:

**English (`en.json`):**
```json
{
  "error": {
    "noTopics": "Add at least one topic",
    "noExamDate": "Select an exam date",
    "invalidExamDate": "Invalid exam date format",
    "examDatePast": "Exam date cannot be in the past",
    "rateLimited": "Please wait before generating again",
    "generationFailed": "Failed to generate study plan. Please try again."
  },
  "regenerateButton": "Regenerate Plan",
  "regenerateWarning": "This will replace your current plan. Continue?",
  "generating": "Generating your plan...",
  "windowRange": "Study window: {start} – {end}",
  "viewPlan": "View Plan",
  "status": {
    "idle": "Not generated",
    "generating": "Generating...",
    "generated": "Generated",
    "failed": "Generation failed"
  }
}
```

**Hebrew (`he.json`):** Equivalent translations.

### Tests (FAIL before, PASS after)

**File**: `tests/unit/i18n/study-plan-keys.spec.ts` (NEW)

1. **Test: "All required study plan i18n keys exist in en.json"**
   - Import `en.json`, check `studyPlan.error.examDatePast`, `studyPlan.regenerateButton`, `studyPlan.status.generated` exist
   - FAILS before: keys don't exist

2. **Test: "Hebrew translations have all the same keys as English"**
   - Compare `he.json` `studyPlan` keys against `en.json` `studyPlan` keys
   - FAILS before: keys don't exist in Hebrew

### Acceptance Criteria

- [ ] All new error keys present in both `en.json` and `he.json`
- [ ] Keys include: `examDatePast`, `invalidExamDate`, `rateLimited`, `regenerateButton`, `regenerateWarning`, `generating`, `status.*`
- [ ] No missing translations between locales

---

## Step 6: Update Existing PUT Route — Remove Generate Action

**Time estimate**: 15 minutes

**Spec refs**: FR-003

### Files to Touch

- `src/app/api/study-plan/route.ts` (MODIFIED — remove `generate` action from PUT)

### Exact Behavior

- Remove `GenerateRequestSchema` from the `RequestSchema` discriminated union
- Remove `handleGenerate` function
- Keep `toggleStatus` and `editDay` actions on PUT
- The `generate` action now lives exclusively in `POST /api/study-plan/generate`
- Keep GET endpoint unchanged (just reads existing plan)

### Tests (FAIL before, PASS after)

**File**: `tests/unit/api/study-plan-route.spec.ts` (NEW)

1. **Test: "PUT with action='generate' returns 400 Invalid action"**
   - Send PUT with `{ action: 'generate', ... }`
   - Expected: 400 (since generate is no longer a valid action on PUT)
   - FAILS before: PUT currently handles `generate` action successfully

2. **Test: "PUT with action='toggleStatus' still works"**
   - Send PUT with valid toggleStatus body
   - Expected: 200 (existing behavior preserved)

### Acceptance Criteria

- [ ] `PUT /api/study-plan` no longer accepts `action: 'generate'`
- [ ] `toggleStatus` and `editDay` still work on PUT
- [ ] GET endpoint unchanged
- [ ] No automatic generation behavior remains anywhere

---

## Step 7: Integration Test — Full Generate Flow

**Time estimate**: 20 minutes

**Spec refs**: FR-001, FR-002, FR-004, FR-005, FR-006, FR-008, NFR-001

### Files to Touch

- `tests/int/study-plan-generate.int.spec.ts` (NEW)

### Exact Behavior

End-to-end integration test that:
1. Creates a test user via Payload Local API
2. Calls `POST /api/study-plan/generate` with valid data
3. Verifies response includes correct `windowStart`, `windowEnd`, `status: 'generated'`
4. Verifies the plan is persisted in `UserProgress` collection
5. Calls generate again (idempotency) — verifies no duplicate plans
6. Verifies window is exam-anchored (not today-anchored)

### Tests

**File**: `tests/int/study-plan-generate.int.spec.ts`

1. **Test: "Generate creates exam-anchored plan with correct window"**
   - Create user, send generate request with `examDate='2026-04-10'`
   - Assert response has `windowStart='2026-04-04'`, `windowEnd='2026-04-10'`, 7 days
   - Assert days array dates match D-6..D0

2. **Test: "Idempotent — second generate replaces, doesn't duplicate"**
   - Generate once, then generate again with same courseId
   - Query UserProgress → `studyPlans` array should have exactly 1 entry for that courseId

3. **Test: "Unauthenticated request is rejected"**
   - Call without auth headers → 401

4. **Test: "Past exam date is rejected"**
   - Call with `examDate` in the past → 400

### Acceptance Criteria

- [ ] Full generation flow works end-to-end
- [ ] Plan window is correctly anchored to exam date
- [ ] Idempotent upsert works (no duplicates)
- [ ] Auth enforcement works
- [ ] Validation works at API layer

---

## Step 8: Update Existing Tests for New Engine Return Shape

**Time estimate**: 10 minutes

**Spec refs**: (maintenance)

### Files to Touch

- `tests/unit/lib/study-plan/engine.spec.ts` (MODIFIED — update assertions)
- `tests/unit/lib/study-plan/merge.spec.ts` (MODIFIED — update assertions)

### Exact Behavior

Since `generateStudyPlan` now returns `{ days, windowStart, windowEnd }` instead of `StudyPlanDay[]`:
- Update all existing test assertions to destructure `{ days }` from the result
- Update assertions like `result.toHaveLength(7)` → `result.days.toHaveLength(7)`
- Verify `windowStart` and `windowEnd` are present in the return

### Tests

All existing tests in `engine.spec.ts` and `merge.spec.ts` should pass with updated destructuring.

### Acceptance Criteria

- [ ] All existing unit tests pass with new return shape
- [ ] No regressions in test suite
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm test:unit` passes

---

## Summary — Execution Order

| Step | Description | Files | Est. Time |
|------|-------------|-------|-----------|
| 1 | Update types + engine (exam-anchored window) | types.ts, engine.ts, engine.spec.ts | 20 min |
| 2 | Update collection schema + repo types | UserProgress.ts, userProgress.ts | 10 min |
| 3 | Create POST generate endpoint + rate limiter | generate/route.ts, rate-limiter.ts | 30 min |
| 4 | Remove auto-regen, wire manual trigger in UI | useStudyPlan.ts, StudyPlanPage.tsx | 25 min |
| 5 | Add i18n keys | en.json, he.json | 10 min |
| 6 | Remove generate action from PUT route | route.ts | 15 min |
| 7 | Integration test | study-plan-generate.int.spec.ts | 20 min |
| 8 | Update existing tests for new return shape | engine.spec.ts, merge.spec.ts | 10 min |

**Total estimated time**: ~2.5 hours

## Validation Commands

```bash
# Type check
pnpm tsc --noEmit

# Unit tests
pnpm test:unit -- --run

# Integration tests
pnpm test:int -- --run

# Lint
pnpm lint
```

## Recommended Skills

No external skills needed — this task uses standard Payload CMS patterns and Next.js route handlers already present in the codebase.
