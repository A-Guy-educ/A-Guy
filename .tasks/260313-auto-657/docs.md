# Documentation: 260313-auto-657

## Summary
Fixed the lesson introduction container being too narrow on desktop and mobile by updating Tailwind max-width classes in the ExercisesPager component.

## Code Changes
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx`: 
  - Line 178: Changed outer container max-width from `max-w-3xl` (768px) to `max-w-7xl` (1280px)
  - Lines 199, 245, 292: Changed inner content max-width from `max-w-md` (448px) to `max-w-2xl` (672px) for intro, about, and outro page states

## Docs Updated
- No doc updates needed — this is a pure CSS/Tailwind class modification with no new features, patterns, or API changes

## Patterns
- `css-styling` — Simple Tailwind class swap for responsive container width
- `frontend-bugfix` — Low-risk UI fix using existing Tailwind utilities

## Context for Future Work
- The ExercisesPager component handles 4 page states: intro, about, exercise, outro
- The container width change affects intro/about/outro pages but NOT the exercise state (which uses ExerciseWorkspace)
- Mobile padding was already correct (px-4 = 16px) — only desktop max-width needed fixing
- No new tests required as this is a visual/layout-only change with no behavioral impact
