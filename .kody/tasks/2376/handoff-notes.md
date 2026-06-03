## Issue #2376 — /practice redirect fix

**Root cause**: PracticePage was missing the RequireCourseSelection guard that StudyPage has. Additionally, StudyContent's loadData() fallback redirected to '/' instead of '/courses'.

**Changes made**:

1. **src/app/(frontend)/practice/page.tsx** — Added RequireCourseSelection wrapper around StudyContent (matching the StudyPage pattern). When user has no gradeLevel, they are redirected to /courses instead of seeing a broken/empty practice UI.

2. **src/app/(frontend)/study/_components/StudyContent/index.tsx** — Changed loadData() fallback redirect from `window.location.href = '/'` to `window.location.href = '/courses'` (belt-and-suspenders fix; RequireCourseSelection intercepts first for PracticePage).

3. **tests/int/study-content-redirect.int.spec.ts** — New integration test validating prefetchStudyData behavior and documenting the expected /courses redirect.

**Why**: When an authenticated user without a gradeLevel visited /practice, RequireCourseSelection was NOT applied (unlike /study), so StudyContent's loadData() fallback redirected to '/' which shows HomePage and then redirects to /start. The fix ensures /practice redirects to /courses (course selection) consistently with RequireCourseSelection guard behavior.
