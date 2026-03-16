# Plan: 260316-auto-877

## Rerun Context

This is a rerun requested via `/cody rerun`. No previous plan/build/review files exist — only a rerun-feedback.md with a generic rerun trigger. The approach from the spec (gap analysis) is correct: the `backUrl` variable in LessonPage points to the chapter page instead of the lesson page, causing the ExercisesPager "Finish" button to redirect to the wrong page. The plan below implements this fix with a TDD reproduction test.

## Research Findings

- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` ✅ exists — Line 86: `const backUrl = '/courses/${courseSlug}/chapters/${chapterSlug}'` (the bug)
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/page.tsx` ✅ exists — Line 101: `const backUrl = '/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}'` (correct reference pattern)
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/complete/page.tsx` ✅ exists — Line 81: same correct pattern
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx` ✅ exists — Line 313: `<SystemLink href={backUrl}>` (the "Finish" button on outro screen uses backUrl directly)
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/useExercisesPager.ts` ✅ exists — Manages page state (intro/about/exercise/outro), does NOT own backUrl
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExerciseWorkspace/index.tsx` ✅ exists — Receives backUrl prop, passes to ExerciseHeader
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExerciseHeader/index.tsx` ✅ exists — `handleBack` uses `router.back()` first, `backUrl` only as fallback (no meaningful change from fix)
- `tests/unit/` ✅ directory exists — unit test pattern uses vitest with `vitest.config.unit.mts`
- `tests/unit/lesson-backurl.test.ts` 🆕 will create

**Patterns observed:**
- All three page files (`page.tsx`, `exercises/[exerciseSlug]/page.tsx`, `complete/page.tsx`) construct `backUrl` as a simple template literal string
- ExercisesPager uses `backUrl` prop for: (1) outro "Finish" button `<SystemLink href={backUrl}>`, (2) ExerciseWorkspace back header
- ExerciseHeader's `handleBack()` prefers `router.back()` (browser history) over `backUrl`; backUrl is only a fallback when no history exists

**Integration points:**
- `backUrl` flows: LessonPage → ExercisesPager → ExerciseWorkspace → ExerciseHeader
- `backUrl` flows: LessonPage → ExerciseWorkspace (empty lesson case) → ExerciseHeader
- Changing the single variable on line 86 will fix the "Finish" button redirect and has negligible impact on the back arrow (which prefers browser history)

## Reuse Inventory

- No new utilities needed
- No new components needed
- Only a one-line change in an existing file

---

### Step 1: Write reproduction test + Fix backUrl in LessonPage

**Root Cause**: The `backUrl` variable in `LessonPage` (line 86) is set to `/courses/${courseSlug}/chapters/${chapterSlug}` (chapter page). When the ExercisesPager renders the "outro" screen and the student clicks "Finish", the `<SystemLink href={backUrl}>` navigates to the chapter page instead of the lesson page. The fix is to change the backUrl to include `/lessons/${lessonSlug}`.

**Files to Touch**:
- `tests/unit/lesson-backurl.test.ts` (NEW) — reproduction test
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` (MODIFIED — line 86)

**Reproduction Test**: Write a unit test that validates the backUrl construction pattern (MUST FAIL before fix):

- Test location: `tests/unit/lesson-backurl.test.ts`
- What it tests: A pure function test that extracts the backUrl construction logic and verifies it produces the lesson page URL (not the chapter page URL)
- The test imports and reads the actual page source file, extracts the `backUrl` template literal, and asserts it includes `/lessons/` in the path pattern
- Why it fails before fix: The current code constructs `backUrl` without the `/lessons/${lessonSlug}` suffix

```
Test: "LessonPage backUrl should point to the lesson page, not the chapter page"
- Extract the backUrl assignment from page.tsx using a regex/string search
- Assert the pattern includes `lessons/` segment
- Before fix: FAILS because backUrl = `/courses/${courseSlug}/chapters/${chapterSlug}` (no lessons segment)
- After fix: PASSES because backUrl = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}`
```

**Fix**: Change line 86 in `page.tsx` from:
```typescript
const backUrl = `/courses/${courseSlug}/chapters/${chapterSlug}`
```
to:
```typescript
const backUrl = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}`
```

**Verification**:
- Run: `pnpm vitest run tests/unit/lesson-backurl.test.ts --config vitest.config.unit.mts`
- Before fix → test FAILS (backUrl points to chapter page)
- After fix → test PASSES (backUrl points to lesson page)
- Run: `pnpm -s tsc --noEmit` — no type errors
- Manual verification: On the ExercisesPager outro screen, the "Finish" `<SystemLink>` now navigates to `/courses/{courseSlug}/chapters/{chapterSlug}/lessons/{lessonSlug}` instead of `/courses/{courseSlug}/chapters/{chapterSlug}`

**Acceptance Criteria** (ref: FR-001, FR-002):
- [ ] `backUrl` on line 86 includes `/lessons/${lessonSlug}`
- [ ] The URL pattern matches ExercisePage (line 101) and CompletePage (line 81) for consistency
- [ ] Unit test passes asserting the correct URL pattern
- [ ] TypeScript compilation succeeds with no errors
- [ ] No other files are modified (ExercisePage, CompletePage remain unchanged)
