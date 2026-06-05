## Bug #2481 Fix Summary

**Issue**: Authenticated users were silently redirected from /ask and /practice to /start when they lacked gradeLevel in localStorage.

**Root Cause**: The RequireCourseSelection guard and StudyContent component both redirected ALL users without gradeLevel to /, regardless of their authentication status. Since the middleware already redirects unauthenticated users to /login, these redirects were only affecting authenticated users.

**Files Changed**:

1. `src/ui/web/guards/RequireCourseSelection.tsx`
   - Added `useAuth()` from `@payloadcms/ui` to detect authenticated users
   - Authenticated users without gradeLevel now see the page (with greeting flow) instead of being redirected
   - Unauthenticated guests still redirect to / (landing page)

2. `src/app/(frontend)/study/_components/StudyContent/index.tsx`
   - Removed the `window.location.href = '/'` redirect when gradeLevel is missing
   - Authenticated users without gradeLevel now see the empty state instead of being redirected
   - Unauthenticated users would have been redirected by middleware to /login, so this change only affects authenticated users

**Test File Created**: `tests/e2e/ask-practice-redirect-bug.e2e.spec.ts`
- Documents the expected behavior (authenticated users without gradeLevel should NOT be redirected to /start)
- Could not run due to E2E test infrastructure requiring full build with cloud credentials

**Quality Gates**: All passed (typecheck, lint)
