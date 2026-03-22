# Codebase Context: 260316-auto-877

## Files to Modify
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` (line 107) — Change `backUrl` from chapter URL to course URL
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/page.tsx` (line 101) — Change `backUrl` from lesson URL to course URL
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/complete/page.tsx` (line 81) — Change `backUrl` from lesson URL to course URL

## Files to Read (reference patterns)
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx` — Uses `backUrl` prop in "Finish" button (SystemLink on line 313)
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExerciseWorkspace/index.tsx` — Passes `backUrl` to ExerciseHeader
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExerciseHeader/index.tsx` — Uses `backUrl` in handleBack (line 44)
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/complete/CompleteContent.tsx` — Uses `backUrl` in both SystemLink buttons

## Key Signatures
- `ExercisesPager({ exercises, lessonTitle, backUrl, courseSlug, chapterSlug, lessonSlug, lessonId, ... })` from ExercisesPager/index.tsx
- `ExerciseWorkspace({ exerciseTitle, backUrl, primaryContent, chatContent })` from ExerciseWorkspace/index.tsx
- `ExerciseHeader({ exerciseTitle, backUrl, onMenuClick, user, isAuthLoading, currentUrl })` from ExerciseHeader/index.tsx
- `CompleteContent({ backUrl })` from CompleteContent.tsx

## Reuse Inventory
- `SystemLink` from `@/infra/loading/components/SystemLink` — already used for navigation ✅
- `useRouterWithLoading` from `@/infra/loading/hooks/useRouterWithLoading` — used in ExerciseHeader ✅
- No new utilities needed

## Integration Points
- `backUrl` is a simple string prop passed from server pages → client components
- Change is purely in the URL string computation — no component API changes
- Three server pages independently compute `backUrl` — all three need the same fix
- The `ExercisesPager` outro section (lines 283-332) uses `backUrl` for the "Finish" button via `SystemLink`
- The `ExerciseHeader` handleBack function (line 41-48) uses `backUrl` as fallback when history is empty

## Imports Verified
- `SystemLink` from `@/infra/loading/components/SystemLink` ✅
- `ExercisesPager` from local `_components/ExercisesPager` ✅
- `CompleteContent` from local `./CompleteContent` ✅
- `ExerciseWorkspace` from sibling `exercises/[exerciseSlug]/_components/ExerciseWorkspace` ✅
