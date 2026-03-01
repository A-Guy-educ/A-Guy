# Build Agent Report: 260301-auto-50

## Changes

- **src/lib/study-plan/engine.ts**: Updated `getTimeframeMode()` function to return `survival` for <= 2 days, `high_intensity` for 3-5 days, `balanced` for 6-7 days, and `mastery_cycle` for >= 8 days. Updated `generateStudyPlan()` to generate adaptive day count: `min(7, max(1, daysLeft))`. Added `tasks` and `timeframeMode` fields to each generated day. Added import for `TASK_TEMPLATES`.

- **src/i18n/he.json**: Changed Hebrew "completed" translation from "הושלם" to "בוצע" per spec requirement. Added "strategy" section with labels for each timeframe mode (survival, high_intensity, balanced, mastery_cycle).

- **src/i18n/en.json**: Added "strategy" section with English labels for each timeframe mode.

- **src/app/(frontend)/study-plan/_components/DayCard.tsx**: Updated completed card opacity from `opacity-60` to `opacity-50` per spec. Added mastery color mapping for topic pills (weak=red-500, medium=orange-400, strong=emerald-500). Added task list rendering below topic pills. Added `MasteryLevel` type import.

- **src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx**: Updated MASTERY_COLORS to use orange-400 instead of orange-500 and emerald-500 instead of green-500. Changed Generate button to always be visible (removed conditional rendering). Changed grid layout from 2-column to single-column vertical timeline.

- **tests/unit/lib/study-plan/engine.spec.ts**: Updated tests for new behavior: 
  - Added test for `getTimeframeMode(2)` returning 'survival'
  - Added test for `getTimeframeMode(7)` returning 'balanced'  
  - Added tests for `getTimeframeMode(8)` and `getTimeframeMode(30)` returning 'mastery_cycle'
  - Added tests for adaptive day count (1 day for 0-1 days left, 2 days for 2 days left, 3 days for 3 days left, 7 days for 7+ days left)
  - Added test for timeframeMode and tasks fields
  - Fixed existing tests that used 19 days left (now uses 6-7 days to test balanced mode)

- **tests/unit/lib/study-plan/types.spec.ts**: Fixed TypeScript error by using non-null assertion for optional `tasks` field.

## Tests Written

- Updated tests/unit/lib/study-plan/engine.spec.ts with new test cases for adaptive day count and timeframe mode changes

## Quality

- TypeScript: PASS
- Lint: PASS
- Unit Tests: PASS (2704 tests passed)
