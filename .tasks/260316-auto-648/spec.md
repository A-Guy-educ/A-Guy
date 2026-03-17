# QA Implementation Plan — Specification

## Overview

This specification covers Critical and High Priority items from the QA audit. The goal is to improve security headers, error handling, environment validation, test coverage, and monitoring across the application.

## Requirements

### Phase 1: Critical Items

#### 1. Security Headers (next.config.js)

Add `async headers()` function with split CSP strategy:

- **All routes (`/*`)**: Strict CSP (self, Vercel Blob, YouTube, Sentry tunnel, unsafe-inline for styles)
- **Admin routes (`/admin/*`)**: Permissive CSP (unsafe-eval, unsafe-inline — required by Payload admin panel)

Headers to add for all routes:
- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `X-DNS-Prefetch-Control: on`

#### 2. Frontend Error Boundary

Create new file `src/app/(frontend)/error.tsx`:

- `'use client'` directive
- `useEffect` → `Sentry.captureException(error)`
- Locale-aware text (Hebrew/English via `navigator.language`)
- "Try again" button calling `reset()`
- Tailwind styling consistent with design system

Reference: `src/app/global-error.tsx`, `src/app/(cody)/cody/error.tsx`

#### 3. Environment Variable Validation

Create Zod schema for all required env vars in `src/infra/config/env-validation.ts`:

Required env vars to validate:
- **Server-only**: `DATABASE_URL`, `PAYLOAD_SECRET`, `BLOB_READ_WRITE_TOKEN`
- **Optional but logged if missing**: `SENTRY_DSN`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GITHUB_TOKEN`
- **Public**: `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_SENTRY_DSN`

Strategy: `z.string().min(1)` for required vars. Log a warning (not throw) for optional vars.

Modify `instrumentation.ts` to call validateEnv() in register() for nodejs runtime.

#### 4. Pre-launch E2E Tests

Cherry-pick commit `9631fe7b` from `feat/pre-launch-e2e-verification` branch.

Contains:
- `tests/e2e/helpers/admin.ts` — exercise seeding helpers
- `tests/e2e/helpers/exercise-builders.ts` — content builders
- `tests/e2e/helpers/verification-fixtures.ts` — shared fixtures + loginAsStudent/loginAsAdmin
- 8 spec files in `tests/e2e/verification/`: auth-onboarding, catalog-navigation, lesson-content, exercises, student-support, admin-content, admin-editing, admin-settings

### Phase 2: Sentry Coverage

#### 5a. Enhance Cody API Error Utility

Find the Cody API error utility (handleCodyApiError) and add `Sentry.captureException` call. This fixes all 20 Cody dashboard routes at once.

#### 5b. Add captureAndRespond to Non-Cody Routes

Add `import { captureAndRespond }` + replace `catch` blocks in:
- `api/conversations/by-context`
- `api/blob/upload-token`
- `api/jobs/run-immediate`
- `api/pdfjs-viewer`
- `api/copilotkit`
- `api/agent/message/persist`

#### 5c. Migrate High-Traffic Routes to withApiHandler

Full Zod schema + Sentry + structured logging via `withApiHandler`:
- `api/agent/chat`
- `api/agent/chat/stream`
- `api/exercises/import`
- `api/exercises/validate-answer`

### Phase 3: Infrastructure

#### 6. Zod Validation for Remaining Routes

Add Zod schemas to remaining POST routes:
1. `api/agent/conversation` — accepts `contextKey`, `exerciseId` body fields
2. `api/agent/reset-chat` — accepts `contextKey` body field
3. `api/cody/tasks` POST — accepts task creation params
4. `api/cody/tasks/approve-review` — accepts PR number + task ID

#### 7. CI Coverage Enforcement

Changes to `.github/workflows/ci.yml`:
1. Add `--coverage --reporter=json --reporter=html` to `pnpm test:unit` step
2. Upload coverage report as artifact (retention-days: 7)

Changes to `vitest.config.unit.mts`:
1. Add `coverage` section with `provider: 'v8'`, thresholds at current baseline
2. Set `reporter: ['text', 'json', 'html']`

#### 8. Web Vitals Tracking

Add `Sentry.browserTracingIntegration()` to `src/infra/instrumentation-client.ts` integrations array.

This automatically captures:
- LCP (Largest Contentful Paint)
- FID / INP (Interaction to Next Paint)
- CLS (Cumulative Layout Shift)
- TTFB (Time to First Byte)
- FCP (First Contentful Paint)

Sampled at existing `tracesSampleRate: 0.1` (10%).

## Acceptance Criteria

1. **Security Headers**: All routes return CSP, X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control headers
2. **Error Boundary**: Frontend error.tsx captures exceptions to Sentry, shows locale-aware error message with retry button
3. **Env Validation**: Application validates required env vars at startup, logs warnings for optional vars
4. **E2E Tests**: Cherry-picked tests run successfully
5. **Sentry Coverage**: All Cody routes report errors to Sentry via enhanced utility
6. **Non-Cody Routes**: 6 routes use captureAndRespond pattern
7. **High-Traffic Routes**: 4 routes migrated to withApiHandler with Zod validation
8. **Remaining Zod**: 4 routes have Zod schemas for input validation
9. **CI Coverage**: Coverage reports generated and uploaded as artifacts
10. **Web Vitals**: browserTracingIntegration captures LCP, FID/INP, CLS, TTFB, FCP

## Verification Commands

```bash
pnpm -s tsc --noEmit
pnpm vitest run --config vitest.config.unit.mts
pnpm lint
```
