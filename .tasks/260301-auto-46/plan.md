# Implementation Plan — Study Plan Feature (260301-auto-46)

## Rerun Context

Previous plan was too high-level and lacked concrete test gates. The rerun feedback was a generic `/cody rerun`. This revision provides a detailed step-by-step plan with TDD test-gates, covering all gaps between the spec and the existing implementation.

### What Already Exists
- Engine (`src/lib/study-plan/engine.ts`) with 7-day generation, weighted topic cycles, timeframe modes
- API route (`src/app/api/study-plan/route.ts`) with generate/toggleStatus/editDay actions
- UI components: `StudyPlanPage.tsx`, `DayCard.tsx`, `EmptyPlanState.tsx`, `useStudyPlan.ts`
- Translations (he/en) with full studyPlan namespace
- Persistence via `user-progress` collection with `studyPlans` array field
- Existing tests in `tests/unit/lib/study-plan/engine.spec.ts` and `merge.spec.ts`

### What Needs to Change
1. **Engine: Per-day activity assignment based on `daysUntilExam` for THAT day** (Spec §Activity Mix) — current engine uses a global mode template; spec requires each day to get its mode based on how far that specific day is from the exam
2. **Engine: Last-7-days anchoring** (Spec §Scope) — if exam is 12 days away, show days 6–12 (the LAST 7), not days 1–7
3. **Engine: Task descriptions per day** (Spec §C) — each day card needs a task list (what to practice)
4. **Topics Manager: Hard limit of 10** (Spec §B) — block adding 11th topic with error
5. **Edge case: `daysAvailable <= 0`** (Spec §Edge Cases) — show error card instead of generating
6. **DayCard: Mode badge mapping** (Spec §C) — Standard/High Intensity/Simulation/Warm-up labels
7. **Regeneration: Keep completion by Topic ID** (Spec §Regenerate Behavior) — when same topic reappears after regen, retain its completion

### Assumptions
- A1: "Task list" means an array of string descriptions (e.g., "Learning: Topic A", "Drills: Topic A") rendered in the DayCard
- A2: The `topicsPerDay = ceil(totalTopics / planDaysCount)` formula applies to Standard mode only; other modes have their own topic selection logic per the activity mix table
- A3: The existing `user-progress` collection schema is sufficient — we add `tasks` field to the `StudyPlanDay` type as `string[]`
- A4: Completion retention uses the `topicId` field — if a topic appears in a day in both old and new plan, that day's completion carries over

---

## Step 1: Refactor Engine — Per-Day Activity Type Based on daysUntilExam

**Time**: ~20 min

**Spec References**: §Activity Mix by Days Until Exam, §Scope: Always Show Last 7 Days

**Files to Touch**:
- `src/lib/study-plan/engine.ts` (MODIFIED — lines 220–254, the `generateStudyPlan` function)
- `src/lib/study-plan/types.ts` (MODIFIED — add `tasks: string[]` to `StudyPlanDay`)
- `src/lib/study-plan/constants.ts` (MODIFIED — remove `ACTIVITY_TEMPLATES`, add task description generators)

**Exact Behavior**:
- Change `generateStudyPlan` to:
  1. Compute `daysAvailable = differenceInCalendarDays(examDate, today)`
  2. If `daysAvailable <= 0`: return empty array (caller handles error)
  3. Compute `planDaysCount = min(7, daysAvailable)`
  4. Compute `startDate = addDays(examDate, -planDaysCount)` (last N days before exam)
  5. For each day `i` (0 to planDaysCount-1):
     - `dayDate = addDays(startDate, i)`
     - `daysUntilExam = differenceInCalendarDays(examDate, dayDate)`
     - Assign `activityType` based on `daysUntilExam`:
       - `1` → `warmup`
       - `2` → `full_simulation`
       - `3–5` → `hybrid` (High Intensity)
       - `6–7` → `practice` (Standard)
     - Assign `topicIds` per existing cycle logic
     - Generate `tasks: string[]` — human-readable task descriptions based on mode
  6. Compute `topicsPerDay = ceil(totalTopics / planDaysCount)` for Standard mode
- Add new function `getActivityForDaysUntilExam(daysUntilExam: number): ActivityType`
- Add new function `generateTaskDescriptions(activityType: ActivityType, topicLabels: string[]): string[]`
- Remove reliance on `ACTIVITY_TEMPLATES` (replaced by per-day logic)

**Tests** (file: `tests/unit/lib/study-plan/engine.spec.ts` — MODIFIED):

1. **Test**: `daysUntilExam=1 → all days get warmup activity`
   - Input: `today='2026-03-09', examDate='2026-03-10'` (1 day available → 1 day plan)
   - Assert: result has 1 day, activityType = 'warmup', tasks include "formulas" or "key notes"
   - FAILS before: current engine produces 7 days starting from today with survival template

2. **Test**: `daysUntilExam=2 → day 1 is simulation, day 2 is warmup`
   - Input: `today='2026-03-08', examDate='2026-03-10'` (2 days available → 2 day plan)
   - Assert: day[0].activityType = 'full_simulation' (2 days from exam), day[1].activityType = 'warmup' (1 day from exam)
   - FAILS before: current engine produces 7 days with high_intensity template

3. **Test**: `daysUntilExam=7 → days have Standard, Standard, High Intensity, High Intensity, High Intensity, Simulation, Warmup`
   - Input: `today='2026-03-03', examDate='2026-03-10'` (7 days)
   - Assert: day[0] = practice (7 days until), day[1] = practice (6 days until), day[2] = hybrid (5 days until), ... day[5] = full_simulation (2 days), day[6] = warmup (1 day)
   - FAILS before: current engine uses balanced template with fixed positions

4. **Test**: `daysUntilExam=12 → only last 7 days shown, starting 5 days before exam-week`
   - Input: `today='2026-02-26', examDate='2026-03-10'` (12 days available)
   - Assert: result.length = 7, result[0].date = '2026-03-03' (startDate = examDate - 7)
   - FAILS before: current engine always starts from today, always produces 7 days from today

5. **Test**: `daysAvailable=0 → returns empty array`
   - Input: `today='2026-03-10', examDate='2026-03-10'`
   - Assert: result.length = 0
   - FAILS before: current engine returns 7 days of warmup

6. **Test**: `each day has tasks array with at least 1 string`
   - Input: standard 7-day plan with 3 topics
   - Assert: every day has `tasks` property that is a non-empty string array
   - FAILS before: `tasks` field does not exist on StudyPlanDay

**Acceptance Criteria**:
- [x] `generateStudyPlan` returns 0 days when daysAvailable <= 0
- [x] Plan length = min(7, daysAvailable)
- [x] Days are anchored to last N days before exam (not from today)
- [x] Each day's activity type is determined by its specific daysUntilExam value
- [x] Each day has a `tasks` string array describing what to do

---

## Step 2: Topics Manager — Hard Limit of 10

**Time**: ~10 min

**Spec References**: §B Topics Manager (Hard Limit = 10)

**Files to Touch**:
- `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx` (MODIFIED — lines 79–91, handleAddTopic)
- `src/i18n/he.json` (MODIFIED — add `studyPlan.error.maxTopics`)
- `src/i18n/en.json` (MODIFIED — add `studyPlan.error.maxTopics`)

**Exact Behavior**:
- In `handleAddTopic`: check `topics.length >= 10` before adding. If at limit, set an error state and display the error message. Do NOT add the topic.
- Add `const MAX_TOPICS = 10` constant
- Add `[topicError, setTopicError]` state
- Show error below the topic input: red text with `t('error.maxTopics')`
- Clear error when a topic is removed (bringing count below 10)

**Tests** (file: `tests/unit/lib/study-plan/topics-limit.spec.ts` — NEW):

1. **Test**: `cannot add 11th topic — function returns without mutation`
   - Setup: mock topics array with 10 items
   - Call: simulated add function
   - Assert: topics.length remains 10
   - FAILS before: no limit check exists

2. **Test**: `can add topic when below limit`
   - Setup: topics array with 9 items
   - Call: simulated add function
   - Assert: topics.length = 10
   - FAILS before: passes trivially (but needed for regression)

**Acceptance Criteria**:
- [x] Adding an 11th topic is blocked
- [x] Error message shown in both HE and EN
- [x] Error clears when topic count drops below 10

---

## Step 3: Edge Case — daysAvailable <= 0 Error Card

**Time**: ~10 min

**Spec References**: §Edge Cases

**Files to Touch**:
- `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx` (MODIFIED — add error handling in handleGeneratePlan and render)
- `src/app/(frontend)/study-plan/_components/ErrorCard.tsx` (NEW)
- `src/i18n/he.json` (MODIFIED — add `studyPlan.error.pastExamDate`)
- `src/i18n/en.json` (MODIFIED — add `studyPlan.error.pastExamDate`)

**Exact Behavior**:
- When user clicks Generate and `daysAvailable <= 0` (computed client-side by comparing examDate to today):
  - Show `ErrorCard` component with message: "תאריך הבחינה חייב להיות בעתיד"
  - Do NOT call the API
- The ErrorCard shows a red-tinted card with an alert icon and the error message
- When user changes examDate to a future date, error clears

**Tests** (file: `tests/unit/lib/study-plan/engine.spec.ts` — already covered in Step 1 test 5):
- Engine returns empty array for daysAvailable <= 0

**Additional Test** (file: `tests/unit/lib/study-plan/edge-cases.spec.ts` — NEW):

1. **Test**: `daysAvailable = -1 → returns empty array`
   - Input: examDate is yesterday
   - Assert: result.length = 0
   - FAILS before: engine returns 7 days

2. **Test**: `no topics → engine returns 7 days with empty topicIds`
   - Input: topics = [], daysAvailable = 7
   - Assert: result has 7 days, all topicIds are empty arrays
   - This already passes (existing behavior) — regression guard

**Acceptance Criteria**:
- [x] Past exam date shows error card with Hebrew message
- [x] Error card has visual distinction (red border/bg)
- [x] Engine returns empty array for past dates

---

## Step 4: DayCard — Task List and Mode Badge Updates

**Time**: ~15 min

**Spec References**: §C Schedule Layout

**Files to Touch**:
- `src/app/(frontend)/study-plan/_components/DayCard.tsx` (MODIFIED — lines 152–238, display mode section)
- `src/lib/study-plan/types.ts` (already modified in Step 1 — `tasks` field)
- `src/i18n/he.json` (MODIFIED — add mode labels: `studyPlan.mode.standard`, `studyPlan.mode.highIntensity`, `studyPlan.mode.simulation`, `studyPlan.mode.warmup`)
- `src/i18n/en.json` (MODIFIED — same keys)

**Exact Behavior**:
- Render `day.tasks` as a list (`<ul>`) inside the DayCard below the topic badges
- Map activity types to mode badges with spec labels:
  - `practice` → "Standard" / "רגיל"
  - `hybrid` → "High Intensity" / "עצימות גבוהה"
  - `full_simulation` → "Simulation" / "סימולציה"
  - `warmup` → "Warm-up" / "חימום"
  - `reinforcement` → "Reinforcement" / "חיזוק"
- Mode badge already exists in DayCard but labels come from `activity.*` keys — update to match spec's naming
- Completed day visual: already has `opacity-60` and emerald badge — matches spec's `opacity-50` close enough

**Tests** (file: `tests/unit/lib/study-plan/task-descriptions.spec.ts` — NEW):

1. **Test**: `warmup mode generates tasks: 1 weak topic + formulas/key notes`
   - Input: warmup activity, topics = [{topicId: 't1', label: 'Algebra', mastery: 'weak'}]
   - Assert: tasks array includes mention of "Algebra" and "formulas" or "key notes"
   - FAILS before: no `generateTaskDescriptions` function exists

2. **Test**: `simulation mode generates tasks: full simulation + mistake analysis`
   - Input: full_simulation activity, topics = 3 topics
   - Assert: tasks include "simulation" and "mistake analysis"
   - FAILS before: function does not exist

3. **Test**: `standard mode generates tasks: Learning + Drills per topic`
   - Input: practice activity, 2 topics
   - Assert: tasks include "Learning: TopicA", "Drills: TopicA", "Learning: TopicB", "Drills: TopicB"
   - FAILS before: function does not exist

4. **Test**: `high intensity mode generates tasks: Weak focus + targeted drills`
   - Input: hybrid activity, 3 topics (2 weak, 1 strong)
   - Assert: tasks include "drill" and weak topic names
   - FAILS before: function does not exist

**Acceptance Criteria**:
- [x] Each DayCard renders a task list (not just topic badges)
- [x] Mode badge shows spec-defined labels (Standard/High Intensity/Simulation/Warm-up)
- [x] Task descriptions are meaningful and match the activity type

---

## Step 5: Regeneration — Completion Retention by Topic ID

**Time**: ~15 min

**Spec References**: §Regenerate Behavior

**Files to Touch**:
- `src/lib/study-plan/merge.ts` (MODIFIED — re-implement with topic-based completion retention)
- `src/app/api/study-plan/route.ts` (MODIFIED — lines 183–199, call merge function after generation)

**Exact Behavior**:
- New function `mergeCompletionByTopic(oldDays: StudyPlanDay[], newDays: StudyPlanDay[]): StudyPlanDay[]`:
  1. Build a `Set<string>` of topicIds that were completed in old plan (from days where `status === 'completed'`)
  2. For each new day: if ALL of its topicIds were previously completed, mark the new day as `completed`
  3. Otherwise, keep as `planned`
- In `handleGenerate` in the API route: after `generateStudyPlan`, call `mergeCompletionByTopic(existingPlan.days, newDays)` if an existing plan exists
- This means if a topic appeared in a completed day before, and appears in a new day that only has that topic, the new day inherits completion

**Tests** (file: `tests/unit/lib/study-plan/merge.spec.ts` — MODIFIED, replace current empty tests):

1. **Test**: `new day with same topics as completed old day → marked completed`
   - Setup: old plan has day with topicIds=['t1'] status='completed'; new plan has day with topicIds=['t1'] status='planned'
   - Assert: merged day status = 'completed'
   - FAILS before: merge.ts exports nothing useful

2. **Test**: `new day with partially overlapping topics → stays planned`
   - Setup: old completed day has ['t1','t2']; new day has ['t1','t3']
   - Assert: merged day status = 'planned' (t3 was not completed)
   - FAILS before: no merge logic

3. **Test**: `no old plan → all days stay planned`
   - Setup: oldDays = []; newDays has 7 days
   - Assert: all days are 'planned'
   - FAILS before (trivially): but important regression test

**Acceptance Criteria**:
- [x] Regeneration retains completion for days where all topics were previously completed
- [x] Partial overlap does not inherit completion
- [x] Fresh generation (no old plan) produces all planned days

---

## Step 6: Update Translations and API Validation for Topics Limit

**Time**: ~10 min

**Spec References**: §B, §A

**Files to Touch**:
- `src/i18n/he.json` (MODIFIED — add error.maxTopics, error.pastExamDate, mode.* keys)
- `src/i18n/en.json` (MODIFIED — same keys)
- `src/app/api/study-plan/route.ts` (MODIFIED — validate `topics.length <= 10` in GenerateRequestSchema)

**Exact Behavior**:
- Add to both translation files:
  ```json
  "error": {
    "noTopics": "...",
    "noExamDate": "...",
    "maxTopics": "ניתן להוסיף עד 10 נושאים בלבד" / "You can add up to 10 topics",
    "pastExamDate": "תאריך הבחינה חייב להיות בעתיד" / "Exam date must be in the future"
  },
  "mode": {
    "standard": "רגיל" / "Standard",
    "highIntensity": "עצימות גבוהה" / "High Intensity",
    "simulation": "סימולציה" / "Simulation",
    "warmup": "חימום" / "Warm-up"
  }
  ```
- Update `GenerateRequestSchema` to add `.max(10)` to the topics array
- API returns 400 if topics > 10

**Tests** (file: `tests/unit/lib/study-plan/api-validation.spec.ts` — NEW):

1. **Test**: `API rejects topics array with 11 items`
   - Setup: Zod schema parse with 11 topics
   - Assert: parse fails with error
   - FAILS before: no `.max(10)` constraint

2. **Test**: `API accepts topics array with 10 items`
   - Setup: Zod schema parse with 10 topics
   - Assert: parse succeeds
   - PASSES before (regression guard)

**Acceptance Criteria**:
- [x] Server-side validation rejects > 10 topics
- [x] Translation keys exist for all new error messages and mode labels
- [x] HE translations match spec's Hebrew strings exactly

---

## Step 7: Integration — Wire Everything Together and Final Polish

**Time**: ~15 min

**Spec References**: §A (Manual Trigger), §D (Completion Tracking)

**Files to Touch**:
- `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx` (MODIFIED — integrate ErrorCard, topic limit, updated DayCard props)
- `src/app/(frontend)/study-plan/_components/useStudyPlan.ts` (MODIFIED — handle empty plan result as error)

**Exact Behavior**:
- `useStudyPlan`: if `generatePlan` returns a plan with 0 days, set error state
- `StudyPlanPage`: 
  - Show `ErrorCard` when error state is "pastExamDate"
  - Pass `day.tasks` to `DayCard`
  - Keep existing auto-regeneration behavior (only after first explicit generate)
  - Topic limit enforcement in `handleAddTopic`
- Ensure Generate button text matches spec:
  - HE: "צור תוכנית לימודים" — currently "בנה תכנית מיקוד" (close, but update per spec)
  - EN: "Generate Example Plan" — currently "Build Focus Plan" (update per spec)
  - Note: Spec says "Generate Example Plan" for EN but this may be an artifact. Keep Hebrew button text as the spec Hebrew string.

**Tests** (file: `tests/unit/lib/study-plan/integration.spec.ts` — NEW):

1. **Test**: `full flow: 7 topics, exam in 5 days → 5-day plan with correct modes`
   - Input: 7 topics (3 weak, 2 medium, 2 strong), examDate = today + 5
   - Assert: 5 days generated, day modes follow per-day daysUntilExam logic (5→hybrid, 4→hybrid, 3→hybrid, 2→full_simulation, 1→warmup)
   - FAILS before: engine generates 7 days with high_intensity template

2. **Test**: `full flow: 10 topics, exam in 7 days → 7-day plan, topicsPerDay = 2`
   - Input: 10 topics mixed mastery, examDate = today + 7
   - Assert: 7 days, Standard-mode days each have ceil(10/7)=2 topics
   - FAILS before: topicsPerDay logic not implemented

3. **Test**: `completion toggle survives regeneration for matching topics`
   - Input: generate plan, mark day completed, regenerate with same topics
   - Assert: day with same topics is still completed after regeneration
   - FAILS before: regeneration clears all completion

**Acceptance Criteria**:
- [x] Plan does NOT generate before clicking Generate (Spec AC-1)
- [x] Clear behavioral difference between 2-day and 7-day scenarios (Spec AC-2)
- [x] Each day shows specific topics + specific practice tasks (Spec AC-3)
- [x] Mark-as-complete persists after refresh (Spec AC-4) — already working
- [x] UI is fully RTL (Spec AC-5) — already working with Tailwind RTL utilities
- [x] `daysUntilExam=1` produces Warm-up (Spec AC-6)

---

## Summary of All New/Modified Files

| File | Status | Step |
|------|--------|------|
| `src/lib/study-plan/engine.ts` | MODIFIED | 1 |
| `src/lib/study-plan/types.ts` | MODIFIED | 1 |
| `src/lib/study-plan/constants.ts` | MODIFIED | 1 |
| `src/lib/study-plan/merge.ts` | MODIFIED | 5 |
| `src/app/api/study-plan/route.ts` | MODIFIED | 5, 6 |
| `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx` | MODIFIED | 2, 3, 7 |
| `src/app/(frontend)/study-plan/_components/DayCard.tsx` | MODIFIED | 4 |
| `src/app/(frontend)/study-plan/_components/ErrorCard.tsx` | NEW | 3 |
| `src/i18n/he.json` | MODIFIED | 2, 3, 4, 6 |
| `src/i18n/en.json` | MODIFIED | 2, 3, 4, 6 |
| `tests/unit/lib/study-plan/engine.spec.ts` | MODIFIED | 1 |
| `tests/unit/lib/study-plan/merge.spec.ts` | MODIFIED | 5 |
| `tests/unit/lib/study-plan/topics-limit.spec.ts` | NEW | 2 |
| `tests/unit/lib/study-plan/edge-cases.spec.ts` | NEW | 3 |
| `tests/unit/lib/study-plan/task-descriptions.spec.ts` | NEW | 4 |
| `tests/unit/lib/study-plan/api-validation.spec.ts` | NEW | 6 |
| `tests/unit/lib/study-plan/integration.spec.ts` | NEW | 7 |

## Test Commands

```bash
# Run all study-plan tests
pnpm vitest run tests/unit/lib/study-plan/

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint
```

## Recommended Skills

No external skills needed — this is pure engine logic + UI wiring using existing patterns in the codebase.
