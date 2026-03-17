# Codebase Context: 260313-auto-657

## Files to Modify
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx` (lines 178, 199, 245, 292) — Widen container and inner content constraints

## Files to Read (reference patterns)
- `tailwind.config.mjs` — Verify container padding config (lines 31-47: container screens/padding)
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/useExercisesPager.ts` — Understand page states: intro, about, exercise, outro
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` — Understand how ExercisesPager is rendered with introDescription/introMedia props

## Key Signatures
- `ExercisesPager({ exercises, lessonTitle, backUrl, courseSlug, chapterSlug, lessonSlug, lessonId, introDescription, introMedia, mediaMap }: ExercisesPagerProps)` from `ExercisesPager/index.tsx`
- `useExercisesPager({ exercises, courseSlug, chapterSlug, lessonSlug, hasAboutPage })` from `ExercisesPager/useExercisesPager.ts`
- Page states: `'intro' | 'about' | 'exercise' | 'outro'` — type `PageType` from `useExercisesPager.ts`

## Reuse Inventory
- Tailwind `max-w-7xl` (1280px) — built-in class, matches spec
- Tailwind `max-w-2xl` (672px) — built-in class for readable prose width
- Tailwind `container` class with responsive padding from `tailwind.config.mjs`
- No new utilities, components, or helpers needed

## Integration Points
- The ExercisesPager is rendered from `page.tsx` (line 115) for lessons with exercises
- Container width change affects intro, about, and outro page states but NOT the exercise state (which uses ExerciseWorkspace instead)
- No backend changes needed — pure CSS/Tailwind class modification

## Imports Verified
- `SafeHtml` from `@/ui/web/SafeHtml` — used on line 242 for intro description ✅
- `getMediaUrl` from `@/infra/utils/getMediaUrl` — used on line 253 for intro media ✅
- `Button` from `@/ui/web/components/button` — used throughout ✅

## Test Infrastructure
- E2E tests use Playwright in `tests/e2e/` directory
- E2E helpers exist at `tests/e2e/helpers/` (auth.ts, courses.ts)
- No existing tests cover ExercisesPager width behavior
