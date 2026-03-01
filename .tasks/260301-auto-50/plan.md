# Study Plan Generator — Implementation Plan

## Rerun Context

Previous run produced a high-level plan that was never implemented (rerun via `/cody rerun`). This new plan provides low-level, step-by-step implementation details with TDD test gates at every step.

### Key problems in current code identified during analysis:
1. **Engine always generates 7 days** — ignores `daysUntilExam` for day count (spec requires `min(7, max(1, daysUntilExam))`)
2. **Only 3 timeframe modes** — spec requires 4 modes: survival (1-2d), high_intensity (3-5d), balanced (6-7d), mastery_cycle (8+d)
3. **Completed badge says "הושלם"** — spec requires "בוצע"
4. **Completed cards use opacity-60** — spec requires opacity-50
5. **No concrete activity tasks** — each day needs specific practice action descriptions
6. **DayCard doesn't show mastery-colored topic pills** — spec requires Weak=red-500, Medium=orange-400, Strong=emerald-500

### Assumptions:
- The i18n provider at `@/ui/web/providers/I18n` remains unchanged
- The `UserProgress` collection schema for `studyPlans` JSON array is flexible enough for our changes (no schema migration needed)
- `default-course` and `default` gradeLevel hardcoding remains for now (demo mode)

---

## Step 1: Update Types — Add `mastery_cycle` TimeframeMode + Concrete Tasks

**Time estimate**: 10 minutes

**Files to Touch**:
- `src/lib/study-plan/types.ts` (MODIFIED — lines 2, 4, 12-22)

**Behavior**:
- Add `mastery_cycle` to `TimeframeMode` union type
- Add `tasks` field to `StudyPlanDay` — array of `{ label: string; description: string }` for concrete activities
- Add `timeframeMode` field to `StudyPlanDay` so the UI can display the strategy name

**Tests** (FAIL before, PASS after):
- Test location: `tests/unit/lib/study-plan/types.spec.ts` (NEW)
- Test 1: `TimeframeMode includes mastery_cycle` — Import the type and create a variable with `mastery_cycle` value; TypeScript compilation test (via `tsc --noEmit`)
- Test 2: `StudyPlanDay has tasks array` — Create a StudyPlanDay literal with tasks; TypeScript compilation passes

**Acceptance Criteria**:
- [ ] `TimeframeMode = 'survival' | 'high_intensity' | 'balanced' | 'mastery_cycle'`
- [ ] `StudyPlanDay.tasks` is `Array<{ label: string; description: string }>`
- [ ] `StudyPlanDay.timeframeMode` is `TimeframeMode`
- [ ] `tsc --noEmit` passes

---

## Step 2: Update Constants — Add `mastery_cycle` Template + Task Templates

**Time estimate**: 15 minutes

**Files to Touch**:
- `src/lib/study-plan/constants.ts` (MODIFIED — lines 17-37, add new export)

**Behavior**:
- Add `mastery_cycle` entry to `ACTIVITY_TEMPLATES` — 7-day template focused on intensive weak-topic drills: `['practice', 'practice', 'reinforcement', 'practice', 'hybrid', 'practice', 'reinforcement']`
- Add `TASK_TEMPLATES` constant — maps each `ActivityType` to an array of concrete task descriptions (Hebrew + English keys for i18n)
- Update `getTimeframeMode` thresholds per spec: `<=2` → survival, `3-5` → high_intensity, `6-7` → balanced, `>=8` → mastery_cycle

**Tests** (FAIL before, PASS after):
- Test location: `tests/unit/lib/study-plan/engine.spec.ts` (MODIFIED — add new describe block)
- Test 1: `getTimeframeMode(2) returns survival` — Currently returns `high_intensity`, must return `survival` (spec: 1-2 days = survival)
- Test 2: `getTimeframeMode(6) returns balanced` — Already passes (6 → balanced)
- Test 3: `getTimeframeMode(7) returns balanced` — Currently returns balanced, continues to pass
- Test 4: `getTimeframeMode(8) returns mastery_cycle` — Currently returns `balanced`, must return `mastery_cycle`
- Test 5: `getTimeframeMode(30) returns mastery_cycle` — Currently returns `balanced`, must return `mastery_cycle`
- Test 6: `ACTIVITY_TEMPLATES.mastery_cycle is defined and has 7 entries`

**Acceptance Criteria**:
- [ ] `getTimeframeMode(0)` → `survival`
- [ ] `getTimeframeMode(1)` → `survival`
- [ ] `getTimeframeMode(2)` → `survival`
- [ ] `getTimeframeMode(3)` → `high_intensity`
- [ ] `getTimeframeMode(5)` → `high_intensity`
- [ ] `getTimeframeMode(6)` → `balanced`
- [ ] `getTimeframeMode(7)` → `balanced`
- [ ] `getTimeframeMode(8)` → `mastery_cycle`
- [ ] `getTimeframeMode(30)` → `mastery_cycle`
- [ ] `ACTIVITY_TEMPLATES.mastery_cycle` exists with 7 activities
- [ ] All existing tests still pass

---

## Step 3: Adaptive Day Count in Engine — `min(7, max(1, daysUntilExam))`

**Time estimate**: 20 minutes

**Files to Touch**:
- `src/lib/study-plan/engine.ts` (MODIFIED — `generateStudyPlan` function, lines 220-254)

**Behavior**:
- Change the hardcoded `7` in the for-loop to `const dayCount = Math.min(7, Math.max(1, daysLeft))`
- Special case: if `daysLeft <= 0`, set `dayCount = 1` (exam today = single warmup day)
- Attach `timeframeMode` to each generated `StudyPlanDay`
- Generate concrete `tasks` array for each day based on `TASK_TEMPLATES[activityType]`

**Tests** (FAIL before, PASS after):
- Test location: `tests/unit/lib/study-plan/engine.spec.ts` (MODIFIED — update existing + add new)
- Test 1: `daysUntilExam = 3 generates exactly 3 days` — Currently generates 7, must generate 3
- Test 2: `daysUntilExam = 1 generates exactly 1 day with warmup activity` — Currently generates 7
- Test 3: `daysUntilExam = 0 generates exactly 1 warmup day` — Currently generates 7
- Test 4: `daysUntilExam = 10 generates exactly 7 days` — Already passes (capped at 7)
- Test 5: `each day has timeframeMode field matching getTimeframeMode result`
- Test 6: `each day has non-empty tasks array`
- **Update existing tests**: Tests that assert `toHaveLength(7)` when daysLeft < 7 need updating (e.g., the survival mode tests with examDate = today will now return 1 day instead of 7)

**Acceptance Criteria**:
- [ ] `daysUntilExam = 0` → 1 day, survival mode, warmup
- [ ] `daysUntilExam = 1` → 1 day, survival mode, warmup
- [ ] `daysUntilExam = 2` → 2 days, survival mode
- [ ] `daysUntilExam = 3` → 3 days, high_intensity mode
- [ ] `daysUntilExam = 5` → 5 days, high_intensity mode
- [ ] `daysUntilExam = 10` → 7 days, mastery_cycle mode
- [ ] Each day has `timeframeMode` and `tasks` fields
- [ ] All updated tests pass
- [ ] `tsc --noEmit` passes

---

## Step 4: Update i18n — Hebrew "בוצע" Badge + Strategy Labels + Task Descriptions

**Time estimate**: 15 minutes

**Files to Touch**:
- `src/i18n/he.json` (MODIFIED — studyPlan section)
- `src/i18n/en.json` (MODIFIED — studyPlan section)

**Behavior**:
- Change `"completed": "הושלם"` to `"completed": "בוצע"` in Hebrew (spec requirement)
- Add `strategy` sub-object with labels for each `TimeframeMode`: `{ survival: "מצב הישרדות", high_intensity: "עצימות גבוהה", balanced: "מאוזן", mastery_cycle: "מחזור שליטה" }`
- Add `taskDescriptions` sub-object per `ActivityType` with 2-3 concrete task labels each:
  - `warmup`: ["סקירה קצרה של נושאים חזקים", "תרגול קל אחד על נושא חלש"]
  - `practice`: ["תרגל 10-15 שאלות בנושא", "סכם טעויות נפוצות"]
  - `hybrid`: ["70% תרגילים על נושאים חלשים", "30% חיזוק נושאים חזקים"]
  - `full_simulation`: ["בחינת סימולציה מלאה בזמן אמיתי", "ניתוח טעויות אחרי"]
  - `reinforcement`: ["חזור על טעויות מימים קודמים", "תרגול ממוקד בנקודות תורפה"]
- Add `daysUntilExamLabel` and `strategyLabel` keys for the header display

**Tests** (FAIL before, PASS after):
- Test location: `tests/unit/components/DayCard.test.tsx` (NEW)
- Test 1: `completed day shows "בוצע" badge text` — render DayCard with status=completed, assert text "בוצע" present
- Test 2: `completed day does NOT show "הושלם"` — assert "הושלם" is NOT in the document

**Acceptance Criteria**:
- [ ] Hebrew `completed` translation is `"בוצע"` (not `"הושלם"`)
- [ ] English `completed` translation remains `"Completed"`
- [ ] All 4 strategy labels exist in both languages
- [ ] Task description templates exist for all 5 activity types
- [ ] `tsc --noEmit` passes

---

## Step 5: Update DayCard — Mastery Colors, Opacity-50, Tasks List

**Time estimate**: 20 minutes

**Files to Touch**:
- `src/app/(frontend)/study-plan/_components/DayCard.tsx` (MODIFIED — lines 9-16, 150-240)

**Behavior**:
- Change completed opacity from `opacity-60` to `opacity-50` (spec: line 56)
- Add mastery-colored topic pills: lookup each topicId's mastery level from topics prop, apply colors: weak=`text-red-500 bg-red-500/10`, medium=`text-orange-400 bg-orange-400/10`, strong=`text-emerald-500 bg-emerald-500/10`
- Render `day.tasks` as a list of concrete activity descriptions below the topic pills
- Display `timeframeMode` strategy badge at top of card

**Tests** (FAIL before, PASS after):
- Test location: `tests/unit/components/DayCard.test.tsx` (NEW or extend from Step 4)
- Test 1: `completed card has opacity-50 class` — render with status=completed, check container has `opacity-50`
- Test 2: `weak topic pill has red-500 color class` — render with a weak mastery topic, assert `text-red-500` class
- Test 3: `strong topic pill has emerald-500 color class` — render with a strong topic, assert `text-emerald-500`
- Test 4: `day card renders task descriptions` — render with tasks array, assert task labels visible in DOM
- Test 5: `non-completed card does NOT have opacity-50` — render with status=planned, assert no `opacity-50`

**Acceptance Criteria**:
- [ ] Completed cards have `opacity-50` (not `opacity-60`)
- [ ] Topic pills show mastery colors (red/orange/emerald)
- [ ] Concrete tasks are rendered as a visible list
- [ ] Non-completed cards have no opacity reduction
- [ ] `tsc --noEmit` passes

---

## Step 6: Update StudyPlanPage — Adaptive Title + Strategy Display

**Time estimate**: 15 minutes

**Files to Touch**:
- `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx` (MODIFIED — lines 140-253)

**Behavior**:
- Change page title/subtitle to be adaptive: if plan exists, show strategy name and day count instead of static "7-Day Focus Plan"
- Show current `timeframeMode` strategy badge in the schedule header
- Ensure the vertical timeline layout renders cards in a single column with connecting line (currently grid 2-col, change to vertical timeline)
- Generate button always visible in sidebar (not just `!hasGenerated`), allowing re-generation
- Pass `topics` with mastery info to DayCard so it can color pills

**Tests** (FAIL before, PASS after):
- Test location: `tests/unit/components/StudyPlanPage.test.tsx` (NEW)
- Test 1: `Generate button is always visible when examDate and topics are set, even after generation` — set hasGenerated=true, assert generate button still in DOM
- Test 2: `plan with 3 days renders exactly 3 DayCards` — mock useStudyPlan to return 3-day plan, count DayCard renders

**Acceptance Criteria**:
- [ ] Generate button visible even after plan exists (allows re-generation)
- [ ] Correct number of DayCards rendered matching plan.days.length
- [ ] Strategy name displayed in schedule header
- [ ] `tsc --noEmit` passes

---

## Step 7: Integration Test — Full Scenario Validation

**Time estimate**: 25 minutes

**Files to Touch**:
- `tests/unit/lib/study-plan/scenarios.spec.ts` (NEW)

**Behavior**:
- End-to-end unit tests that validate the complete engine behavior for the specific acceptance criteria scenarios

**Tests**:
- Test 1: `2-day scenario: exam in 2 days → 2 days, survival mode, all warmup`
  ```
  input: today=2026-03-01, examDate=2026-03-03, topics=[weak, medium, strong]
  assert: result.length === 2
  assert: result[0].timeframeMode === 'survival'
  assert: all days have activityType === 'warmup'
  assert: each day has tasks array
  ```

- Test 2: `10-day scenario: exam in 10 days → 7 days, mastery_cycle mode`
  ```
  input: today=2026-03-01, examDate=2026-03-11, topics=[weak, medium, strong]
  assert: result.length === 7
  assert: result[0].timeframeMode === 'mastery_cycle'
  assert: days have varied activity types (practice, reinforcement, hybrid)
  ```

- Test 3: `1-day scenario (daysUntilExam=1): exactly 1 warmup day`
  ```
  input: today=2026-03-01, examDate=2026-03-02
  assert: result.length === 1
  assert: result[0].activityType === 'warmup'
  assert: result[0].timeframeMode === 'survival'
  ```

- Test 4: `5-day scenario: high_intensity mode, 5 days`
  ```
  input: today=2026-03-01, examDate=2026-03-06
  assert: result.length === 5
  assert: result[0].timeframeMode === 'high_intensity'
  ```

- Test 5: `7-day scenario: balanced mode, 7 days`
  ```
  input: today=2026-03-01, examDate=2026-03-08
  assert: result.length === 7
  assert: result[0].timeframeMode === 'balanced'
  ```

- Test 6: `each day in every scenario has specific topics + non-empty tasks`

- Test 7: `weak-focus fallback: topics only medium and strong → medium topics treated as primary`

**Acceptance Criteria**:
- [ ] 2-day scenario passes (2 days, survival)
- [ ] 10-day scenario passes (7 days, mastery_cycle)
- [ ] 1-day scenario passes (1 warmup day)
- [ ] 5-day scenario passes (5 days, high_intensity)
- [ ] 7-day scenario passes (7 days, balanced)
- [ ] All days have topics + tasks
- [ ] All tests pass: `pnpm vitest run tests/unit/lib/study-plan/`

---

## Step 8: Update Existing Tests — Fix Breaking Assertions

**Time estimate**: 15 minutes

**Files to Touch**:
- `tests/unit/lib/study-plan/engine.spec.ts` (MODIFIED)
- `tests/unit/lib/study-plan/merge.spec.ts` (MODIFIED)

**Behavior**:
- Update tests that assert `toHaveLength(7)` when the exam is close — these now produce fewer days
- Update `getTimeframeMode` tests: `2 days → survival` (was high_intensity), `30 days → mastery_cycle` (was balanced)
- Update survival mode tests to expect 1 day (not 7) when examDate matches today
- Ensure merge tests handle variable-length plans

**Tests**:
- All existing test files must pass after updates
- Run: `pnpm vitest run tests/unit/lib/study-plan/`

**Acceptance Criteria**:
- [ ] `engine.spec.ts` — all tests green
- [ ] `merge.spec.ts` — all tests green
- [ ] No test regressions in any other file

---

## Step 9: API Route Update — Pass Through New Fields

**Time estimate**: 10 minutes

**Files to Touch**:
- `src/app/api/study-plan/route.ts` (MODIFIED — lines 186-200)

**Behavior**:
- Ensure `validatedDays` mapping preserves new fields: `tasks`, `timeframeMode`
- No logic changes needed in the route — just ensure the spread operator captures new fields

**Tests** (FAIL before, PASS after):
- Test location: `tests/unit/api/study-plan.spec.ts` (NEW — lightweight)
- Test 1: `generated plan days include timeframeMode field` — Call engine with known input, assert field exists in output
- Test 2: `generated plan days include tasks array` — Assert tasks is non-empty array

**Acceptance Criteria**:
- [ ] API response includes `timeframeMode` on each day
- [ ] API response includes `tasks` array on each day
- [ ] `tsc --noEmit` passes

---

## Step 10: Final Quality Gates

**Time estimate**: 10 minutes

**Files to Touch**: None (verification only)

**Commands to Run**:
```bash
pnpm vitest run tests/unit/lib/study-plan/
pnpm vitest run tests/unit/components/DayCard.test.tsx
pnpm vitest run tests/unit/components/StudyPlanPage.test.tsx
pnpm -s tsc --noEmit
pnpm -s lint
```

**Acceptance Criteria** (maps to spec acceptance criteria):
- [ ] Plan generation happens only on Generate button click (Step 6)
- [ ] Clear behavioral difference between 2-day and 10-day scenarios (Step 7, Tests 1+2)
- [ ] 2-day scenario: 2 days shown, Survival Mode warmup (Step 7, Test 1)
- [ ] 10-day scenario: 7 days shown, Mastery Cycle mode (Step 7, Test 2)
- [ ] Each day shows specific topics + concrete activity tasks (Steps 3, 5)
- [ ] Completion state persists after refresh (existing — useStudyPlan + API already handles this)
- [ ] UI is RTL and matches visual style (existing — already RTL)
- [ ] `daysUntilExam = 1` yields exactly 1 warmup day (Step 7, Test 3)
- [ ] Completed days show `opacity-50` and `בוצע` badge (Steps 4, 5)
- [ ] All tests pass
- [ ] TypeScript compilation passes
- [ ] Lint passes

---

## Summary of File Changes

| File | Action | Step |
|------|--------|------|
| `src/lib/study-plan/types.ts` | MODIFIED | 1 |
| `src/lib/study-plan/constants.ts` | MODIFIED | 2 |
| `src/lib/study-plan/engine.ts` | MODIFIED | 2, 3 |
| `src/i18n/he.json` | MODIFIED | 4 |
| `src/i18n/en.json` | MODIFIED | 4 |
| `src/app/(frontend)/study-plan/_components/DayCard.tsx` | MODIFIED | 5 |
| `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx` | MODIFIED | 6 |
| `src/app/api/study-plan/route.ts` | MODIFIED | 9 |
| `tests/unit/lib/study-plan/engine.spec.ts` | MODIFIED | 2, 3, 8 |
| `tests/unit/lib/study-plan/merge.spec.ts` | MODIFIED | 8 |
| `tests/unit/lib/study-plan/scenarios.spec.ts` | NEW | 7 |
| `tests/unit/components/DayCard.test.tsx` | NEW | 4, 5 |
| `tests/unit/components/StudyPlanPage.test.tsx` | NEW | 6 |

## Test Commands

```bash
# Run all study plan tests
pnpm vitest run tests/unit/lib/study-plan/

# Run component tests
pnpm vitest run tests/unit/components/DayCard.test.tsx
pnpm vitest run tests/unit/components/StudyPlanPage.test.tsx

# Type check
pnpm -s tsc --noEmit

# Lint
pnpm -s lint
```
