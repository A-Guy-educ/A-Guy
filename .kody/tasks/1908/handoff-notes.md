## Fix Summary

Added `export const metadata = { title: 'Statistics' }` to `src/app/(frontend)/stats/page.tsx`. This follows the existing pattern used by other frontend pages (login, account, onboarding/persona) where a metadata export sets the page title. The root layout uses `'%s | A-Guy'` as the title template, so this will render as "Statistics | A-Guy" in the browser tab.

Also created a new E2E test at `tests/e2e/stats-page-title.e2e.spec.ts` that asserts the page title.

**Files changed:**
- `src/app/(frontend)/stats/page.tsx` — added metadata export
- `tests/e2e/stats-page-title.e2e.spec.ts` — new test file (note: E2E tests require a running dev server and cannot be executed in this environment)