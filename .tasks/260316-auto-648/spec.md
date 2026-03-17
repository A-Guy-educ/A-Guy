# QA Implementation Plan — Spec

## Overview

This implementation addresses Critical and High Priority items from the QA audit. The plan covers security hardening, error handling, env validation, Sentry coverage, Zod validation, and CI improvements.

## Requirements

### Phase 1: Critical Items

#### 1. Security Headers (next.config.js)
- Add `async headers()` function with split CSP strategy
- All routes (`/*`): Strict CSP (self, Vercel Blob, YouTube, Sentry tunnel, unsafe-inline for styles)
- Admin routes (`/admin/*`): Permissive CSP (unsafe-eval, unsafe-inline for Payload admin)
- Headers for all routes:
  - Content-Security-Policy
  - X-Frame-Options: DENY
  - Strict-Transport-Security: max-age=31536000; includeSubDomains
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: strict-origin-when-cross-origin
  - Permissions-Policy: camera=(), microphone=(), geolocation=()
  - X-DNS-Prefetch-Control: on

#### 2. Frontend Error Boundary
- Create `src/app/(frontend)/error.tsx`
- Use 'use client' directive
- UseEffect to capture error to Sentry
- Locale-aware text (Hebrew/English)
- "Try again" button calling reset()
- Tailwind styling consistent with design system

#### 3. Env Variable Validation
- Create `src/infra/config/env-validation.ts` with Zod schema
- Validate required: DATABASE_URL, PAYLOAD_SECRET, BLOB_READ_WRITE_TOKEN
- Optional (warn): SENTRY_DSN, OPENAI_API_KEY, GEMINI_API_KEY, GITHUB_TOKEN
- Public: NEXT_PUBLIC_SERVER_URL, NEXT_PUBLIC_SENTRY_DSN
- Required vars: z.string().min(1), Optional: log warning only
- Hook into instrumentation.ts

#### 4. Pre-launch E2E Tests
- Cherry-pick commit 9631fe7b from feat/pre-launch-e2e-verification
- Contains: helpers (admin, exercise-builders, verification-fixtures) + 8 spec files

### Phase 2: Sentry Coverage

#### 5a. Cody API Error Utility
- Find handleCodyApiError utility
- Add Sentry.captureException call

#### 5b. Non-Cody Routes
- Add captureAndRespond to 6 routes:
  - api/conversations/by-context
  - api/blob/upload-token
  - api/jobs/run-immediate
  - api/pdfjs-viewer
  - api/copilotkit
  - api/agent/message/persist

#### 5c. High-traffic Routes Migration
- Migrate 4 routes to withApiHandler (Zod + Sentry + logging):
  - api/agent/chat
  - api/agent/chat/stream
  - api/exercises/import
  - api/exercises/validate-answer

### Phase 3: Infrastructure

#### 6. Zod Validation for Remaining Routes
- Add Zod schemas to POST routes:
  - api/agent/conversation (contextKey, exerciseId)
  - api/agent/reset-chat (contextKey)
  - api/cody/tasks POST
  - api/cody/tasks/approve-review

#### 7. CI Coverage Enforcement
- Add --coverage --reporter=json --reporter=html to test:unit
- Upload coverage artifact (retention 7 days)
- Add coverage config to vitest.config.unit.mts

#### 8. Web Vitals Tracking
- Add Sentry.browserTracingIntegration() to instrumentation-client.ts

## Acceptance Criteria

1. All security headers present in responses (verify via curl)
2. Frontend error.tsx catches errors and shows retry UI
3. Env validation logs warnings at startup, throws on missing required vars
4. E2E tests run successfully after cherry-pick
5. All 30+ routes report errors to Sentry
6. All POST routes have Zod validation
7. Coverage reports generated and uploaded
8. Web Vitals captured in Sentry
