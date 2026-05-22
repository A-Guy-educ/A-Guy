# Issue #1830 Fix - Handoff Notes

## Bug Summary
Core frontend routes (/ask, /practice, /test, /stats) redirected to /start instead of rendering their own content. This was a UX bug where unauthenticated or unconfigured users were caught in a redirect loop.

## Root Cause
Three client components checked for `gradeLevel` in localStorage and redirected to `/` (homepage) when missing. The homepage redirects to `/start` when no home page exists in the CMS. This created the confusing redirect chain.

## Fix
Changed all four redirect targets from `/` to `/courses` (the course catalog where users select their grade level):

1. **RequireCourseSelection** (src/ui/web/guards/RequireCourseSelection.tsx:15) — `router.replace('/courses')`
2. **StudyContent** (src/app/(frontend)/study/_components/StudyContent/index.tsx:136) — `window.location.href = '/courses'`
3. **AskContent** (src/app/(frontend)/ask/_components/AskContent/index.tsx:29) — `window.location.href = '/courses'`
4. **AskConversationGrid** (src/app/(frontend)/ask/_components/AskConversationGrid/index.tsx:87) — `window.location.href = '/courses'`

## Test
Added `tests/unit/guards/RequireCourseSelection.test.tsx` with 3 tests verifying the correct redirect behavior.

## Files Changed
- `src/ui/web/guards/RequireCourseSelection.tsx`
- `src/app/(frontend)/study/_components/StudyContent/index.tsx`
- `src/app/(frontend)/ask/_components/AskContent/index.tsx`
- `src/app/(frontend)/ask/_components/AskConversationGrid/index.tsx`
- `tests/unit/guards/RequireCourseSelection.test.tsx` (new)
