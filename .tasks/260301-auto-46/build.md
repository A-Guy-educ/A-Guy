# Build Agent Report: 260301-auto-46

## Changes

- **Engine Refactor (Step 1)**: Modified `src/lib/study-plan/engine.ts` to:
  - Calculate per-day activity type based on daysUntilExam for each specific day (1=Warmup, 2=Simulation, 3-5=High Intensity, 6-7=Standard)
  - Show last 7 days before exam instead of 7 days starting from today
  - Return empty array when exam date is in the past
  - Added `tasks: string[]` to each day for task descriptions

- **Types Update (Step 1)**: Updated `src/lib/study-plan/types.ts` to add `tasks` field to `StudyPlanDay`

- **Topics Limit (Step 2)**: Created `src/lib/study-plan/topics-limit.ts` with:
  - `MAX_TOPICS = 10` constant
  - `addTopicWithLimit()` function for enforcing hard limit
  - `removeTopic()` function

- **Topics Limit UI (Step 2)**: Modified `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx` to:
  - Import and use `addTopicWithLimit` from topics-limit
  - Add `topicError` state for displaying error when limit reached
  - Disable add button and input when at limit (10)
  - Show error message in Hebrew/English

- **Error Card (Step 3)**: Created `src/app/(frontend)/study-plan/_components/ErrorCard.tsx` for displaying past exam date error

- **Past Exam Date Validation (Step 3)**: Modified `StudyPlanPage.tsx` to:
  - Add `examDateError` state
  - Validate exam date is in the future before generating
  - Show error card when plan returns 0 days

- **DayCard Updates (Step 4)**: Modified `src/app/(frontend)/study-plan/_components/DayCard.tsx` to:
  - Render task list (`day.tasks`) as bullet points
  - Use mode badge labels (Standard/High Intensity/Simulation/Warm-up) instead of activity keys

- **Completion Retention (Step 5)**: Updated `src/lib/study-plan/merge.ts` with:
  - `mergeCompletionByTopic()` function to retain completion status when regenerating plan
  - If all topics in a new day were completed in old plan, new day inherits 'completed' status

- **API Route Updates (Step 5, 6)**: Modified `src/app/api/study-plan/route.ts` to:
  - Import and use `mergeCompletionByTopic` in handleGenerate
  - Add `.max(10)` validation to topics array
  - Add fallback for legacy plans without `tasks` field

- **Translations (Step 6)**: Updated `src/i18n/he.json` and `src/i18n/en.json` with:
  - `error.maxTopics`: "ניתן להוסיף עד 10 נושאים בלבד" / "You can add up to 10 topics"
  - `error.pastExamDate`: "תאריך הבחינה חייב להיות בעתיד" / "Exam date must be in the future"
  - `mode.standard`: "רגיל" / "Standard"
  - `mode.highIntensity`: "עצימות גבוהה" / "High Intensity"
  - `mode.simulation`: "סימולציה" / "Simulation"
  - `mode.warmup`: "חימום" / "Warm-up"
  - Updated `generateButton` text

## Tests Written

- **tests/unit/lib/study-plan/engine.spec.ts** - Added 9 new tests for:
  - Per-day activity type based on daysUntilExam
  - Last 7 days anchoring to exam date
  - Empty array for past exam dates

- **tests/unit/lib/study-plan/topics-limit.spec.ts** - Created 12 tests for:
  - Adding topics under limit (10)
  - Blocking 11th topic
  - Error clearing when topics removed

- **tests/unit/lib/study-plan/merge.spec.ts** - Already existed with 7 tests

## Quality

- TypeScript: PASS (pnpm -s tsc --noEmit)
- Lint: PASS (2 warnings only for @typescript-eslint/no-explicit-any)
- Tests: PASS (43 tests passed in 3 test files)
