# Codebase Context: 260318-auto-762

## Files to Modify
- `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx` (lines 127, 354-366) — Remove `exerciseNumber` prop destructuring and the Exercise Number Bubble JSX block
- `src/ui/web/exerciserenderer/types.ts` (lines 202-203) — Remove `exerciseNumber?: number` property from `ExerciseRendererProps`

## Files to Create
- `tests/unit/ui/exercise-renderer-number-bubble.test.tsx` (NEW) — Reproduction test verifying no number bubble is rendered

## Files to Read (reference patterns)
- `tests/unit/ui/exercise-renderer-side-by-side.test.tsx` — Test pattern for ExerciseRenderer unit tests (vitest + jsdom + @testing-library/react, mock pattern)
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx` — Primary consumer showing external "Exercise X of Y" header (lines 157-173), calls ExerciseRenderer at line 177

## Key Signatures
- `export function ExerciseRenderer({ content, mode, showCheckAnswer, className, mediaMap, exerciseNumber, lessonId, exerciseId, onResultsChange }: ExerciseRendererProps)` from `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx`
- `export interface ExerciseRendererProps` from `src/ui/web/exerciserenderer/types.ts` (line 195)
- `export type { ExerciseRendererProps, UserAnswer, CheckResult, PreviewMode } from './types'` from `src/ui/web/exerciserenderer/index.ts`

## Reuse Inventory
- `cn` from `@/infra/utils/ui` — already in use in ExerciseRenderer
- `@testing-library/react` — already used in existing test files
- `vitest` — project test framework

## Integration Points
- ExerciseRenderer is imported by 3 consumers:
  1. `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx` (line 7)
  2. `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExercisePageContent/index.tsx` (line 3)
  3. `src/app/(frontend)/exercises/[id]/page.tsx` (line 5)
- **None of these consumers pass `exerciseNumber`**, confirming safe removal

## Imports Verified
- `@/ui/web/exerciserenderer/ExerciseRenderer` → exports `ExerciseRenderer` ✅
- `@/ui/web/exerciserenderer` → re-exports `ExerciseRenderer` and `ExerciseRendererProps` ✅
- `@/ui/web/exerciserenderer/types` → exports `ExerciseRendererProps` interface ✅
- No consumer references `exerciseNumber` prop ✅

## Bug Location Summary
- **The bug**: Lines 354-366 in `ExerciseRenderer/index.tsx` render a circle with `exerciseNumber` (defaults to `1`)
- **Why it's redundant**: ExercisesPager already shows "Exercise X of Y" at lines 158-161
- **Fix**: Delete the bubble JSX and the unused prop
