# Codebase Context: 260316-auto-877

## Files to Modify
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` (line 86) — Change backUrl from chapter page to lesson page
- `tests/unit/lesson-backurl.test.ts` (NEW) — Reproduction test for backUrl bug

## Files to Read (reference patterns)
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/page.tsx` (line 101) — Correct backUrl pattern to match
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/complete/page.tsx` (line 81) — Correct backUrl pattern to match
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx` (lines 65-171, 283-332) — Consumer of backUrl: ExerciseWorkspace (line 69) and outro "Finish" button (line 313)
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExerciseHeader/index.tsx` (lines 41-49) — handleBack uses router.back() first, backUrl only as fallback
- `vitest.config.unit.mts` — Unit test configuration (run with `--config vitest.config.unit.mts`)

## Key Signatures
- `export default async function LessonPage({ params }: LessonPageProps)` from `page.tsx` — The server component containing the buggy backUrl
- `export function ExercisesPager({ exercises, lessonTitle, backUrl, ... })` from `ExercisesPager/index.tsx` — Component receiving backUrl prop
- `export function ExerciseWorkspace({ exerciseTitle, backUrl, primaryContent, chatContent })` from `ExerciseWorkspace/index.tsx` — Component passing backUrl to header
- `export function ExerciseHeader({ exerciseTitle, backUrl, ... })` from `ExerciseHeader/index.tsx` — Uses backUrl as fallback in handleBack

## Reuse Inventory
- No existing utilities or patterns to reuse — this is a one-line string fix

## Integration Points
- `backUrl` flows: LessonPage (line 86) → ExercisesPager (prop) → ExerciseWorkspace (prop) → ExerciseHeader (prop)
- `backUrl` also flows: LessonPage (line 133, 175) → ExerciseWorkspace → ExerciseHeader (for empty lesson and PDF cases)
- The outro "Finish" button in ExercisesPager (line 313) uses `<SystemLink href={backUrl}>` — this is the direct redirect that users experience as the bug

## Imports Verified
- No new imports needed — the fix is changing a template literal string value
- `lessonSlug` variable already exists in scope (destructured from `params` on line 33)
