Fixed bug #2032: Authenticated users were redirected to /start when visiting /ask, /practice, or /stats without a gradeLevel in localStorage.

Root cause: RequireCourseSelection guard and StudyContent component both redirected to / when gradeLevel was missing. Since / falls through to /start, users saw the wrong page.

Changes:
1. `src/ui/web/guards/RequireCourseSelection.tsx`: Changed router.replace('/') to router.replace('/courses')
2. `src/app/(frontend)/study/_components/StudyContent/index.tsx`: Changed window.location.href = '/' to window.location.href = '/courses'

Both redirect to /courses (grade selection) which is the appropriate destination for any user without a selected grade, regardless of authentication status.

Created E2E test: tests/e2e/ask-redirect-when-authenticated.e2e.spec.ts (needs full environment to run).
