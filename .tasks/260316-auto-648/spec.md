# QA Implementation Plan — Specification

## Overview

This plan implements Critical and High Priority items from a QA security and quality audit. The implementation covers 8 main areas across 3 phases, focusing on security headers, error handling, environment validation, Sentry coverage, Zod validation, CI coverage enforcement, and Web Vitals tracking.

## Critical Items (Phase 1)

### 1. Security Headers — next.config.js

Add `async headers()` function with split CSP strategy:
- **All routes (`/*`)**: Strict CSP (self, Vercel Blob, YouTube, Sentry tunnel, unsafe-inline for styles)
- **Admin routes (`/admin/*`)**: Permissive CSP (unsafe-eval, unsafe-inline — required by Payload admin panel)

Headers for all routes:
- Content-Security-Policy
- X-Frame-Options: DENY
- Strict-Transport-Security: max-age=31536000; includeSubDomains
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=()
- X-DNS-Prefetch-Control: on

### 2. Frontend Error Boundary

Create `src/app/(frontend)/error.tsx`:
- 'use client' directive
- useEffect → Sentry.captureException(error)
- Locale-aware text (Hebrew/English)
- "Try again" button calling reset()
- Tailwind styling

### 3. Environment Variable Validation

Create `src/infra/config/env-validation.ts` with Zod schema:
- **Required**: DATABASE_URL, PAYLOAD_SECRET, BLOB_READ_WRITE_TOKEN
- **Optional (warn)**: SENTRY_DSN, OPENAI_API_KEY, GEMINI_API_KEY, GITHUB_TOKEN
- **Public**: NEXT_PUBLIC_SERVER_URL, NEXT_PUBLIC_SENTRY_DSN

Called from instrumentation.ts at startup.

### 4. Pre-launch E2E Tests

Cherry-pick commit 9631fe7b from feat/pre-launch-e2e-verification branch.

## Sentry Coverage (Phase 2)

### 5a. Cody API Error Utility
Enhance handleCodyApiError utility with Sentry.captureException

### 5b. Non-Cody Routes
Add captureAndRespond to 6 routes:
- api/conversations/by-context
- api/blob/upload-token
- api/jobs/run-immediate
- api/pdfjs-viewer
- api/copilotkit
- api/agent/message/persist

### 5c. High-Traffic Routes
Migrate 4 routes to withApiHandler:
- api/agent/chat
- api/agent/chat/stream
- api/exercises/import
- api/exercises/validate-answer

## Infrastructure (Phase 3)

### 6. Zod Validation
Add Zod schemas to:
- api/agent/conversation
- api/agent/reset-chat
- api/cody/tasks (POST)
- api/cody/tasks/approve-review

### 7. CI Coverage Enforcement
- Add --coverage flags to test:unit
- Upload coverage report as artifact
- Add coverage config to vitest.config.unit.mts

### 8. Web Vitals Tracking
Add Sentry.browserTracingIntegration() to instrumentation-client.ts

## Acceptance Criteria

1. Security headers are applied correctly (strict for frontend, permissive for admin)
2. Frontend error boundary captures errors to Sentry
3. Required env vars are validated at startup
4. E2E test helpers are available
5. All Cody routes report errors to Sentry
6. 6 non-Cody routes report errors to Sentry
7. 4 high-traffic routes use withApiHandler
8. 4 remaining routes have Zod validation
9. CI runs with coverage reporting
10. Web Vitals are tracked in Sentry
