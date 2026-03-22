# Build Agent Report: 260316-auto-822-qa-implementation-plan-critical-hi

## Changes

### Step 1: Security Headers (next.config.js)
- Added async `headers()` function to `nextConfig` with two route groups:
  - General routes (`/:path*`): Strict CSP (no unsafe-eval)
  - Admin routes (`/admin/:path*`): Permissive CSP (unsafe-eval for Payload admin)
- All 7 security headers present: CSP, X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control

### Step 2: Frontend Error Boundary (src/app/(frontend)/error.tsx)
- Created new Client Component error boundary for frontend routes
- Uses Sentry.captureException for error reporting
- Locale detection for Hebrew/English
- "Try again" button that calls reset()
- No html/body wrapper (nested boundary pattern)

### Step 3: Env Validation (src/infra/config/env-validation.ts + instrumentation.ts)
- Created new Zod-based env validation function
- Required vars (throw): DATABASE_URL, PAYLOAD_SECRET, BLOB_READ_WRITE_TOKEN
- Optional vars (warn): SENTRY_DSN, OPENAI_API_KEY, GEMINI_API_KEY, GITHUB_TOKEN
- Public vars (warn): NEXT_PUBLIC_SERVER_URL, NEXT_PUBLIC_SENTRY_DSN
- Hooked into instrumentation.ts nodejs runtime block

### Step 4: handleCodyApiError Enhancement (src/ui/cody/github-error-handler.ts)
- Added `import * as Sentry from '@sentry/nextjs'`
- Added `Sentry.captureException(error, { tags: { route: routeName } })` to capture all errors
- Single change covers 14+ Cody routes that use this handler

### Step 5: captureAndRespond to 6 Non-Cody Routes
- conversations/by-context (3 catch blocks: GET, POST, DELETE)
- blob/upload-token (1 catch block, added error param)
- jobs/run-immediate (1 catch block)
- pdfjs-viewer (1 catch block)
- copilotkit (1 catch block)
- agent/message/persist (1 catch block for non-ZodError branch)

### Step 6: Sentry to 4 High-Traffic Routes
- agent/chat (dynamic import Sentry.captureException)
- agent/chat/stream (dynamic import Sentry.captureException)
- exercises/import (dynamic import Sentry.captureException)
- exercises/validate-answer (dynamic import Sentry.captureException)

### Step 7: Zod Validation + Sentry for 4 POST Routes
- agent/conversation: Added Zod schema, replaced manual validation, added Sentry
- agent/reset-chat: Added Zod schema, replaced manual validation, added Sentry
- cody/tasks POST: Added Zod schema, added ZodError handling
- cody/tasks/approve-review: Added Zod schema, replaced manual validation, added Sentry

### Step 8: CI Coverage + Web Vitals
- CI workflow: Added `--coverage` flag to test:unit command
- CI workflow: Added artifact upload step for coverage report
- instrumentation-client.ts: Added browserTracingIntegration() for web vitals (LCP, FID, CLS, TTFB, FCP)

## Tests Written

- Updated `tests/unit/ui/cody/api/tasks-create.test.ts` to expect new Zod validation error format

## Deviations

- None — plan followed exactly

## Quality

- TypeScript: PASS
- Lint: PASS
- Tests: 4025 passed, 18 skipped
