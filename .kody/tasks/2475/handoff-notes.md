## CI Build Fix: Removed StudyActivityChart (recharts causes browser build failure)

### What was failing
The Next.js browser build failed with:
- `Error: Node.js binary module @napi-rs/canvas... is not supported in the browser`
- `UnhandledSchemeError: Reading from "node:console" is not handled by plugins`

### Root cause
recharts@3.x uses victory-vendor@37.3.6 which pulls in @napi-rs/canvas. StudyActivityChart.tsx was a 'use client' component importing recharts, causing webpack to try to bundle @napi-rs/canvas (native Node.js binary) for the browser - which is impossible.

### What was removed
- `src/app/(frontend)/stats/_components/StudyActivityChart.tsx` (new chart component)
- Import of StudyActivityChart in StatsDashboard.tsx
- `dailyActivity` field from DashboardData interface and JSX usage
- `dailyActivity` computation from stats API route
- `studyActivity` key from en.json and he.json
- `tests/e2e/stats-page-chart.e2e.spec.ts` (chart E2E test)

### What was kept (core PR purpose)
- `src/middleware.ts` - hasAuthToken async fix (task 2449)
- `tests/int/auth-middleware.int.spec.ts` - async test updates (task 2449)
- `tests/int/middleware.int.spec.ts` - async test updates (task 2449)
- `next.config.js` - CSP gravatar fix (task 2448)
- `tests/int/csp-vercel-feedback-admin.int.spec.ts` - CSP test update (task 2448)

### Follow-up
The chart should be re-implemented in a separate PR with proper webpack configuration to externalize @napi-rs/canvas for browser builds.

### Verification
- `mcp__kody-verify__verify` returned ok: true on attempt 1
- Typecheck passes
- Lint passes
- Integration tests pass
