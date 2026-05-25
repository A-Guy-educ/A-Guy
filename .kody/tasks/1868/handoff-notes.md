# Fix: Ask page grade badge appears orphaned above main content

## What was done

**Root cause**: In `AskConversationGrid`, the `GradeSection` was rendered as a sibling to `<main>`, making the grade badge appear disconnected from the page content.

**Fix**: Integrated the grade badge into the page header inside `<main>` by:
1. Moving the `useExamCountdown` hook call before the early return (fixes React hooks rule violation)
2. Removing the standalone `GradeSection` component
3. Adding a page header `<div>` with border-b inside `<main>` containing the grade badge and exam reminder
4. Keeping the section title after the header

## Files changed

- `src/app/(frontend)/ask/_components/AskConversationGrid/index.tsx` - Restructured layout to integrate grade badge into page header
- `tests/int/ask-page-grade-badge.int.spec.ts` - New integration test validating courseLabel is returned correctly by the API

## Notes

- The fix mirrors the pattern used in `StudyContent` where grade badge is inside the gradient header area, not a separate section above main content
- Integration test for the API layer passes; actual UI rendering would need E2E test to verify
- Lint and typecheck both pass
