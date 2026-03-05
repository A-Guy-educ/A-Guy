# Build Plan: Exam-Anchored Manual Study Plan Generation

**Task ID**: 260302-auto-25
**Type**: implement_feature
**Created**: 2026-03-02

---

## Pre-Implementation Analysis

### Codebase Understanding (verified via exploration)

| Component | File | Lines | Key Notes |
|---|---|---|---|
| Engine | `src/lib/study-plan/engine.ts` | 254 | `generateStudyPlan()` returns `StudyPlanDay[]`, anchors 7 days to `today` |
| Types | `src/lib/study-plan/types.ts` | 37 | `StudyPlanSnapshot`, `GeneratePlanInput`, `StudyPlanDay` |
| API Route | `src/app/api/study-plan/route.ts` | 335 | PUT with `generate`/`toggleStatus`/`editDay` actions |
| Hook | `src/app/(frontend)/study-plan/_components/useStudyPlan.ts` | 184 | Calls `PUT /api/study-plan` with `action: 'generate'` |
| Page | `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx` | 254 | Auto-regen `useEffect` at lines 117-127, `pendingRegeneration` ref |
| Collection | `src/server/payload/collections/UserProgress.ts` | 174 | `studyPlans` array without `windowStart`/`windowEnd`/`status` |
| Repo | `src/server/repos/queries/userProgress.ts` | 113 | Mirrored types, missing user-override fields |
| i18n EN | `src/i18n/en.json` | ~511 | `studyPlan` namespace exists, needs new error/status keys |
| i18n HE | `src/i18n/he.json` | ~511 | Same structure, needs new keys |
| Engine tests | `tests/unit/lib/study-plan/engine.spec.ts` | 285 | 18 tests, all expect `StudyPlanDay[]` return |
| Merge tests | `tests/unit/lib/study-plan/merge.spec.ts` | 111 | 6 tests, all expect `StudyPlanDay[]` return |
| EmptyPlanState | `src/app/(frontend)/study-plan/_components/EmptyPlanState.tsx` | 16 | Simple empty state component |
| Merge module | `src/lib/study-plan/merge.ts` | 3 | Gutted — just `export {}` |
| Constants | `src/lib/study-plan/constants.ts` | 45 | `ACTIVITY_TEMPLATES` has 7-entry arrays per mode |
| Rate limiter | `src/lib/study-plan/rate-limiter.ts` | N/A | Does NOT exist yet |
| DayCard | `src/app/(frontend)/study-plan/_components/DayCard.tsx` | 240 | Display/edit day component |

### Key Decisions

1. **Engine return type change**: `generateStudyPlan` will return `{ days: StudyPlanDay[], windowStart: string, windowEnd: string }` instead of `StudyPlanDay[]`. This requires updating all callers and tests.
2. **New POST route**: `POST /api/study-plan/generate` for explicit generation. The old `generate` action is removed from PUT.
3. **Rate limiter**: Simple in-memory `Map<string, number>` with 10-second cooldown.
4. **Auto-regeneration removal**: Delete the `useEffect` at `StudyPlanPage.tsx:117-127` and the `pendingRegeneration` ref.

---

## Step 1: Update Types — Add Window and Status Fields

**Files**:
- `src/lib/study-plan/types.ts` (MODIFY)

### Changes

**`types.ts`** — Add `windowStart`, `windowEnd`, `status` to `StudyPlanSnapshot`; add engine result type:

Add to `StudyPlanSnapshot` (lines 24-30):
```typescript
export interface StudyPlanSnapshot {
  courseId: string
  examDate: string
  generatedAt: string
  topics: TopicInput[]
  days: StudyPlanDay[]
  windowStart: string    // NEW — YYYY-MM-DD
  windowEnd: string      // NEW — YYYY-MM-DD
  status: 'idle' | 'generating' | 'generated' | 'failed'  // NEW
  lastError?: string     // NEW — optional, for admin debugging
}
```

Add new type after `StudyPlanSnapshot`:
```typescript
export interface GeneratePlanResult {
  days: StudyPlanDay[]
  windowStart: string
  windowEnd: string
}
```

No changes to `GeneratePlanInput` — it already has `today` and `examDate`.

### Validation
- `pnpm tsc --noEmit` will fail until subsequent steps update all consumers

---

## Step 2: Update Engine — Exam-Anchored Window (D-6..D0)

**Files**:
- `src/lib/study-plan/engine.ts` (MODIFY — lines 220-254)

### Changes

Replace `generateStudyPlan` function body. Change return type from `StudyPlanDay[]` to `GeneratePlanResult`.

**Current behavior**: Generates 7 days starting from `today`, regardless of exam date.

**New behavior**:
1. Parse `today` and `examDate` as ISO dates
2. Validate `examDate >= today` — throw error if past
3. Compute `windowEnd = examDate`
4. Compute `windowStart = max(today, examDate - 6 days)`
5. Compute `numDays = differenceInCalendarDays(windowEnd, windowStart) + 1` (1 to 7)
6. Get `daysLeft = differenceInCalendarDays(examDate, today)` for mode selection
7. Get `mode = getTimeframeMode(daysLeft)`
8. Get `template = ACTIVITY_TEMPLATES[mode]` — use `template[dayIndex % template.length]` for each day
9. Build days array from `windowStart` to `windowEnd`
10. Return `{ days, windowStart: format(...), windowEnd: format(...) }`

Key code:
```typescript
import type { GeneratePlanResult } from './types'

export function generateStudyPlan(input: GeneratePlanInput): GeneratePlanResult {
  const { today, examDate, topics, idGenerator } = input
  const todayDate = parseISO(today)
  const examDateObj = parseISO(examDate)

  if (examDateObj < todayDate) {
    throw new Error('Exam date cannot be in the past')
  }

  const windowEndDate = examDateObj
  const fullWindowStart = addDays(examDateObj, -6)
  const windowStartDate = fullWindowStart > todayDate ? fullWindowStart : todayDate
  const numDays = differenceInCalendarDays(windowEndDate, windowStartDate) + 1

  const daysLeft = differenceInCalendarDays(examDateObj, todayDate)
  const mode = getTimeframeMode(daysLeft)
  const template = ACTIVITY_TEMPLATES[mode]

  const sorted = sortTopicsByPriority(topics)
  const cycle = buildTopicCycle(sorted)
  const allTopicIds = topics.map((t) => t.topicId)

  const days: StudyPlanDay[] = []
  for (let dayIndex = 0; dayIndex < numDays; dayIndex++) {
    const date = format(addDays(windowStartDate, dayIndex), 'yyyy-MM-dd')
    const activityType = template[dayIndex % template.length]
    const topicIds = pickTopicsForDay(cycle, dayIndex, activityType, allTopicIds, topics)

    days.push({
      dayId: idGenerator(),
      date,
      activityType,
      topicIds,
      status: 'planned',
      estimatedDurationMinutes: ACTIVITY_DURATIONS[activityType],
    })
  }

  return {
    days,
    windowStart: format(windowStartDate, 'yyyy-MM-dd'),
    windowEnd: format(windowEndDate, 'yyyy-MM-dd'),
  }
}
```

---

## Step 3: Update Collection Schema — Add Window/Status Fields

**Files**:
- `src/server/payload/collections/UserProgress.ts` (MODIFY — within `studyPlans` array fields)
- `src/server/repos/queries/userProgress.ts` (MODIFY — update mirrored types)

### Changes to `UserProgress.ts`

Add these fields inside the `studyPlans` array, after the existing `days` array field:

```typescript
{
  name: 'windowStart',
  type: 'text',
  admin: { description: 'Window start date YYYY-MM-DD' },
},
{
  name: 'windowEnd',
  type: 'text',
  admin: { description: 'Window end date YYYY-MM-DD' },
},
{
  name: 'status',
  type: 'select',
  options: [
    { label: 'Idle', value: 'idle' },
    { label: 'Generating', value: 'generating' },
    { label: 'Generated', value: 'generated' },
    { label: 'Failed', value: 'failed' },
  ],
  defaultValue: 'idle',
},
{
  name: 'lastError',
  type: 'text',
  admin: { description: 'Last error message (redacted for non-admins)' },
},
```

### Changes to `userProgress.ts` (repo types)

Update the `StudyPlanSnapshot` interface (lines 30-36) — make new fields optional for backward compat:

```typescript
export interface StudyPlanSnapshot {
  courseId: string
  examDate: string
  generatedAt: string
  topics: StudyPlanTopicInput[]
  days: StudyPlanDay[]
  windowStart?: string
  windowEnd?: string
  status?: 'idle' | 'generating' | 'generated' | 'failed'
  lastError?: string
}
```

---

## Step 4: Create Rate Limiter

**Files**:
- `src/lib/study-plan/rate-limiter.ts` (NEW)
- `src/lib/study-plan/index.ts` (MODIFY — add re-export)

### Implementation

```typescript
const COOLDOWN_MS = 10_000

const lastGenerationMap = new Map<string, number>()

export function canGenerate(userId: string): boolean {
  const lastTime = lastGenerationMap.get(userId)
  if (!lastTime) return true
  return Date.now() - lastTime >= COOLDOWN_MS
}

export function recordGeneration(userId: string): void {
  lastGenerationMap.set(userId, Date.now())
}

export function resetRateLimiter(): void {
  lastGenerationMap.clear()
}

export const RATE_LIMIT_COOLDOWN_MS = COOLDOWN_MS
```

Update `src/lib/study-plan/index.ts` to add: `export * from './rate-limiter'`

---

## Step 5: Create POST Generation Endpoint

**Files**:
- `src/app/api/study-plan/generate/route.ts` (NEW)

### Implementation

POST handler that:
1. Authenticates via `payload.auth({ headers })` — 401 if no user
2. Rate limit check (per userId, 10s cooldown) — 429 if blocked
3. Parses + validates body with Zod: `{ courseId, examDate (YYYY-MM-DD), topics (min 1), gradeLevel }`
4. Validates exam date not in the past — 400 with i18n key `studyPlan.error.examDatePast`
5. Missing/invalid inputs — 400 with appropriate i18n keys
6. Computes `today = format(startOfDay(new Date()), 'yyyy-MM-dd')`
7. Calls `generateStudyPlan({ today, examDate, topics, idGenerator: nanoid })`
8. Builds `StudyPlanSnapshot` with `windowStart`, `windowEnd`, `status: 'generated'`, `generatedAt`
9. Upserts into `UserProgress.studyPlans` array (find by courseId, replace or push)
10. Records generation for rate limiting
11. Returns `{ success: true, data: newPlan }`
12. Error responses use i18n keys, never leak stack traces

Key imports: `@payload-config`, `date-fns`, `nanoid`, `next/server`, `payload`, `zod`, engine, rate-limiter, repo queries.

Owner is ALWAYS derived from `req.user` (NFR-001). Payload operations use `overrideAccess: false, user` for updates. CSRF is not needed since this is a fetch API (not form-based cookie auth — headers-based auth).

---

## Step 6: Remove Generate Action from Existing PUT Route

**Files**:
- `src/app/api/study-plan/route.ts` (MODIFY)

### Changes

1. **Remove `GenerateRequestSchema`** from the `RequestSchema` discriminated union (lines 26-32, 54-58)
2. **Remove `handleGenerate` function** (lines 159-240)
3. **Remove the `'generate'` case** from the PUT handler switch
4. **Keep**: `ToggleStatusSchema`, `EditDaySchema`, `handleToggleStatus`, `handleEditDay`, GET handler
5. **Update `RequestSchema`**:
```typescript
const RequestSchema = z.discriminatedUnion('action', [
  ToggleStatusSchema,
  EditDaySchema,
])
```

---

## Step 7: Update UI Hook — Call New POST Endpoint

**Files**:
- `src/app/(frontend)/study-plan/_components/useStudyPlan.ts` (MODIFY)

### Changes

1. Add `isGenerating` state (separate from `isLoading`)
2. Add `generationError` state for generation-specific errors
3. Add `hasPlan` computed value
4. Update `generatePlan` to call `POST /api/study-plan/generate` instead of `PUT /api/study-plan` with `action: 'generate'`
5. Update return interface:

```typescript
interface UseStudyPlanReturn {
  plan: StudyPlanSnapshot | null
  isLoading: boolean
  isGenerating: boolean
  error: string | null
  generationError: string | null
  generatePlan: (examDate: string, topics: TopicInput[], courseId: string) => Promise<void>
  toggleDayStatus: (dayId: string) => Promise<void>
  editDay: (dayId: string, edits: {...}) => Promise<void>
  hasPlan: boolean
}
```

The `generatePlan` function changes from:
- `PUT /api/study-plan` with `{ action: 'generate', courseId, examDate, topics, gradeLevel }`

To:
- `POST /api/study-plan/generate` with `{ courseId, examDate, topics, gradeLevel }`

Uses `isGenerating` state (not `isLoading`) to avoid interfering with initial fetch loading state.

---

## Step 8: Update UI Page — Remove Auto-Regen, Add Manual Controls

**Files**:
- `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx` (MODIFY)

### Changes

1. **DELETE** the auto-regeneration `useEffect` (lines 117-127) — the `useEffect` with `setTimeout` that calls `generatePlan` when `hasGenerated && pendingRegeneration.current`
2. **REMOVE** `pendingRegeneration` ref declaration (line 64)
3. **REMOVE** all `pendingRegeneration.current = true` assignments in `handleAddTopic`, `handleRemoveTopic`, `handleMasteryChange`, and exam date change handler
4. **Destructure new values** from `useStudyPlan`: `isGenerating`, `generationError`, `hasPlan`
5. **Show "Regenerate" button** when plan exists (secondary style, with confirmation)
6. **Display `generationError`** inline near the CTA button
7. **Show window range** in schedule header when `plan?.windowStart && plan?.windowEnd`
8. **Update generate button** to show spinner/disabled when `isGenerating`

---

## Step 9: Add i18n Keys

**Files**:
- `src/i18n/en.json` (MODIFY — add to `studyPlan` section)
- `src/i18n/he.json` (MODIFY — add to `studyPlan` section)

### New keys to add under `studyPlan`:

**English**:
```json
"error": {
  "invalidExamDate": "Invalid exam date format",
  "examDatePast": "Exam date cannot be in the past",
  "rateLimited": "Please wait before generating again",
  "generationFailed": "Failed to generate study plan. Please try again.",
  "invalidInput": "Invalid input. Please check your data."
},
"regenerateButton": "Regenerate Plan",
"regenerateWarning": "This will replace your current plan. Continue?",
"regenerateConfirm": "Yes, regenerate",
"regenerateCancel": "Cancel",
"generating": "Generating your plan...",
"windowRange": "Study window: {start} – {end}",
"viewPlan": "View Plan",
"status": {
  "idle": "Not generated",
  "generating": "Generating...",
  "generated": "Generated",
  "failed": "Generation failed"
}
```

NOTE: `error.noTopics` and `error.noExamDate` already exist in both locales — keep them, only add new keys.

**Hebrew**: Equivalent translations for all new keys.

---

## Step 10: Update Existing Tests for New Engine Return Shape

**Files**:
- `tests/unit/lib/study-plan/engine.spec.ts` (MODIFY)
- `tests/unit/lib/study-plan/merge.spec.ts` (MODIFY)

### Changes

Every test calling `generateStudyPlan()` must destructure `{ days, windowStart, windowEnd }`:

```typescript
// Before:
const result = generateStudyPlan(input)
expect(result).toHaveLength(7)

// After:
const { days } = generateStudyPlan(input)
expect(days).toHaveLength(7)
```

**Critical**: Tests that check consecutive dates starting from `today` need adjusted inputs. With exam-anchored logic, if `today='2026-01-01'` and `examDate='2026-01-20'`, the window starts at `2026-01-14` (not today). Set `examDate = addDays(today, 6)` to get a full 7-day window starting from today, preserving existing date assertions.

Update all ~18 tests in engine.spec.ts and all 6 tests in merge.spec.ts.

---

## Step 11: Add New Tests

**Files**:
- `tests/unit/lib/study-plan/engine.spec.ts` (ADD new describe block)
- `tests/unit/lib/study-plan/rate-limiter.spec.ts` (NEW)

### New engine tests

Add `describe('exam-anchored window')` block with 4 tests:
1. "full 7 days when exam >= 7 days away" — windowStart=examDate-6, 7 days
2. "partial window when exam < 7 days away" — windowStart=today, 3 days
3. "exam date in the past throws error" — throws /past/
4. "exam is today generates exactly 1 day" — 1 day

### Rate limiter tests (new file)

4 tests:
1. "allows first generation" — canGenerate returns true
2. "blocks rapid requests" — recordGeneration then canGenerate returns false
3. "allows after cooldown" — fake timers, advance by cooldown, canGenerate returns true
4. "independent per user" — user1 blocked, user2 allowed

---

## Step 12: Generate Types and Validate

**Commands** (run after all code changes):

```bash
pnpm generate:types
pnpm generate:importmap
pnpm tsc --noEmit
pnpm test:unit -- --run
pnpm lint
```

---

## Execution Order

| Step | Description | Files | Depends On |
|------|-------------|-------|------------|
| 1 | Update types | types.ts | — |
| 2 | Update engine | engine.ts | Step 1 |
| 3 | Update collection schema + repo types | UserProgress.ts, userProgress.ts | Step 1 |
| 4 | Create rate limiter | rate-limiter.ts, index.ts | — |
| 5 | Create POST endpoint | generate/route.ts | Steps 1-4 |
| 6 | Remove generate from PUT | route.ts | Step 5 |
| 7 | Update UI hook | useStudyPlan.ts | Steps 1, 5 |
| 8 | Update UI page | StudyPlanPage.tsx | Step 7 |
| 9 | Add i18n keys | en.json, he.json | — |
| 10 | Update existing tests | engine.spec.ts, merge.spec.ts | Steps 1-2 |
| 11 | Add new tests | engine.spec.ts, rate-limiter.spec.ts | Steps 2, 4 |
| 12 | Generate types + validate | — | All steps |

## Risk Areas

1. **Existing test assertions**: 24 tests assume `generateStudyPlan` returns `StudyPlanDay[]`. Every assertion must be updated.
2. **Date expectations in tests**: Tests checking dates from `today` need exam dates adjusted so window starts correctly.
3. **i18n key nesting**: Existing `error.noTopics`/`error.noExamDate` keys must not be overwritten.
4. **Backward compatibility**: Existing DB documents lack new fields. Repo types use optional fields for safety. UI handles undefined gracefully.

## Files Created (New)
- `src/app/api/study-plan/generate/route.ts`
- `src/lib/study-plan/rate-limiter.ts`
- `tests/unit/lib/study-plan/rate-limiter.spec.ts`

## Files Modified
- `src/lib/study-plan/types.ts`
- `src/lib/study-plan/engine.ts`
- `src/lib/study-plan/index.ts`
- `src/server/payload/collections/UserProgress.ts`
- `src/server/repos/queries/userProgress.ts`
- `src/app/api/study-plan/route.ts`
- `src/app/(frontend)/study-plan/_components/useStudyPlan.ts`
- `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx`
- `src/i18n/en.json`
- `src/i18n/he.json`
- `tests/unit/lib/study-plan/engine.spec.ts`
- `tests/unit/lib/study-plan/merge.spec.ts`

## Validation Commands
```bash
pnpm tsc --noEmit
pnpm test:unit -- --run
pnpm lint
```
