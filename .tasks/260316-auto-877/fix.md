# Fix Summary: 260316-auto-877

## Issue
**Bug #851**: After completing an interactive lesson and clicking "Finish", users were redirected to the old chapter page instead of the new course page.

## Root Cause
The `backUrl` property in lesson-related pages was pointing to:
- Lesson page: `/courses/${courseSlug}/chapters/${chapterSlug}` (chapter page)
- Exercise page: `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}` (lesson page)
- Complete page: `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}` (lesson page)

Instead of pointing to the course page (`/courses/${courseSlug}`).

## Fix Applied
Changed `backUrl` in three files to point to `/courses/${courseSlug}`:

1. **`page.tsx`** (lesson page, line 107):
   ```typescript
   const backUrl = `/courses/${courseSlug}`
   ```

2. **`exercises/[exerciseSlug]/page.tsx`** (exercise page, line 101):
   ```typescript
   const backUrl = `/courses/${courseSlug}`
   ```

3. **`complete/page.tsx`** (complete page, line 81):
   ```typescript
   const backUrl = `/courses/${courseSlug}`
   ```

## Tests
- Created `tests/unit/lesson-navigation-back-url.test.ts` with 11 tests
- All tests pass

## Quality Gates
- TypeScript: ✅ PASS
- Lint: ✅ PASS
- Unit tests: ✅ 11/11 PASS

## Commit
- Branch: `fix/260317-auto-852-`
- Hash: `9559e24`
- Status: Committed and pushed
