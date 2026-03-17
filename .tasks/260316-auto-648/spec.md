# QA Implementation Plan — Specification

## Overview

This plan addresses Critical and High Priority items from a full QA audit, covering security headers, error boundaries, env validation, E2E testing, Sentry integration, Zod validation, CI coverage, and web vitals tracking.

## Requirements

### Phase 1: Critical Items

1. **Security Headers** — `next.config.js`
   - Add `async headers()` function with split CSP strategy
   - All routes: Strict CSP (self, Vercel Blob, YouTube, Sentry tunnel, unsafe-inline for styles)
   - Admin routes (`/admin/*`): Permissive CSP (unsafe-eval, unsafe-inline for Payload admin)
   - Headers: Content-Security-Policy, X-Frame-Options, Strict-Transport-Security, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control

2. **Frontend Error Boundary** — `src/app/(frontend)/error.tsx`
   - Create new file mirroring `global-error.tsx` pattern
   - 'use client' directive
   - Sentry.captureException in useEffect
   - Locale-aware text (Hebrew/English)
   - "Try again" button calling reset()
   - Tailwind styling

3. **Env Variable Validation** — `src/infra/config/env-validation.ts`
   - Create Zod schema for all required env vars
   - Required: DATABASE_URL, PAYLOAD_SECRET, BLOB_READ_WRITE_TOKEN
   - Optional (warn): SENTRY_DSN, OPENAI_API_KEY, GEMINI_API_KEY, GITHUB_TOKEN
   - Public: NEXT_PUBLIC_SERVER_URL, NEXT_PUBLIC_SENTRY_DSN
   - Called from instrumentation.ts at startup

4. **Pre-launch E2E Cherry-pick**
   - Cherry-pick commit 9631fe7b from feat/pre-launch-e2e-verification
   - Contains: helpers (admin.ts, exercise-builders.ts, verification-fixtures.ts)
   - 8 spec files in tests/e2e/verification/

### Phase 2: Sentry Coverage

5a. **Enhance handleCodyApiError utility**
   - Add Sentry.captureException call
   - Fixes all 20 Cody dashboard routes at once

5b. **Add captureAndRespond to 6 non-Cody routes**
   - api/conversations/by-context
   - api/blob/upload-token
   - api/jobs/run-immediate
   - api/pdfjs-viewer
   - api/copilotkit
   - api/agent/message/persist

5c. **Migrate 4 routes to withApiHandler**
   - api/agent/chat
   - api/agent/chat/stream
   - api/exercises/import
   - api/exercises/validate-answer

### Phase 3: Infrastructure

6. **Zod Validation for Remaining Routes**
   - api/agent/conversation — contextKey, exerciseId
   - api/agent/reset-chat — contextKey
   - api/cody/tasks POST — task creation params
   - api/cody/tasks/approve-review — PR number + task ID

7. **CI Coverage Enforcement**
   - Add --coverage --reporter=json --reporter=html to test:unit
   - Upload coverage as artifact (7 days)
   - Add coverage section to vitest.config.unit.mts

8. **Web Vitals Tracking**
   - Add Sentry.browserTracingIntegration() to instrumentation-client.ts
   - Captures LCP, INP, CLS, TTFB, FCP

## Acceptance Criteria

- [ ] Security headers present in all routes with split CSP for admin
- [ ] Frontend error boundary catches and reports errors to Sentry
- [ ] Env validation runs at startup with clear error messages
- [ ] E2E tests cherry-picked and integrated
- [ ] All Cody routes report errors to Sentry
- [ ] 6 non-Cody routes use captureAndRespond
- [ ] 4 high-traffic routes migrated to withApiHandler
- [ ] Remaining POST routes have Zod validation
- [ ] CI runs with coverage reporting
- [ ] Web vitals tracked via Sentry

## Files to Modify/Create

### Phase 1
- next.config.js
- src/app/(frontend)/error.tsx (CREATE)
- src/infra/config/env-validation.ts (CREATE)
- instrumentation.ts

### Phase 2
- Cody error utility
- 6 non-Cody route files
- 4 route files for withApiHandler migration

### Phase 3
- 4 route files for Zod validation
- .github/workflows/ci.yml
- vitest.config.unit.mts
- src/infra/instrumentation-client.ts
