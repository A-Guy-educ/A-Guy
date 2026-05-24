# Fix for Issue #1969: Auth-gated routes silent redirect

## Problem
When an authenticated user (with `payload-token` cookie) visited `/ask`, `/practice`, or `/test` without a `gradeLevel` in localStorage, they were silently redirected to `/` (which then redirects to `/start` due to no home page configured). This happened because:

1. `/ask` uses `RequireCourseSelection` guard that called `router.replace('/')` when no gradeLevel
2. `/practice` and `/test` use `StudyContent` which called `window.location.href = '/'` when no gradeLevel

## Fix Applied

### 1. RequireCourseSelection (src/ui/web/guards/RequireCourseSelection.tsx)
- Changed from silently redirecting to `/` to showing a user-friendly message
- Added new UI with an SVG icon, title, description, and "Browse Courses" button
- Uses i18n keys: `selectCourseToAccess`, `selectCourseToAccessMessage`, `browseCourses`
- Added `message` and `redirectUrl` props for customization

### 2. StudyContent (src/app/(frontend)/study/_components/StudyContent/index.tsx)
- Added `requiresCourseSelection` state variable
- Changed `window.location.href = '/'` to `setRequiresCourseSelection(true)` 
- Shows a user-friendly message with "Browse Courses" button instead of redirecting
- Added new UI branch for `requiresCourseSelection === true` case

### 3. Translations (src/i18n/en.json, src/i18n/he.json)
Added new keys under `coursePage`:
- `selectCourseToAccess`: Title message
- `selectCourseToAccessMessage`: Description message
- `browseCourses`: Button label

## Test Added
Created `tests/e2e/auth-gated-routes-redirect.e2e.spec.ts` with E2E tests that verify authenticated users without gradeLevel are NOT silently redirected from `/ask`, `/practice`, and `/test`.

## Verification
- TypeScript compilation: PASSED
- ESLint: PASSED
- Prettier: PASSED
- Full quality gates: PASSED
