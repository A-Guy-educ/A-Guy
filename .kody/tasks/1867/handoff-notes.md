# Issue #1867 - Grade Badge Fix

## What
Bug #1867: Grade badge on /practice page displayed only 'T' instead of the full courseLabel.

## Root Cause
`StudyContent` component received `courseLabel` in `prefetchedData`, stored it in `courseInfo` state, but **never rendered it** in the UI. The bug was a missing render, not a CSS truncation issue as the issue description suggested.

## Fix
Added grade badge rendering in `StudyContent/index.tsx` (lines 313-318), matching the established pattern from `AskConversationGrid`'s `GradeSection` component:

```tsx
{courseInfo?.courseLabel && (
  <span className="text-body-sm md:text-body-md font-extrabold text-primary uppercase tracking-[0.3em]">
    {t('grade')} {courseInfo.courseLabel}
  </span>
)}
```

## Files Changed
- `src/app/(frontend)/study/_components/StudyContent/index.tsx` — added badge render
- `tests/int/study-page-grade-badge.int.spec.ts` — integration test verifying courseLabel is returned non-empty

## Verification
- All 3 integration tests pass
- Quality gates (typecheck, lint, test) pass on first attempt
