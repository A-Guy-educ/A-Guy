# QA Implementation Plan — Specification

## Overview

This plan implements Critical and High Priority items from a QA audit covering security headers, error boundaries, environment validation, Sentry integration, Zod validation, CI coverage, and Web Vitals tracking.

## Requirements

### Phase 1: Critical Items

1. **Security Headers** — `next.config.js`
   - Add `async headers()` function with split CSP strategy
   - All routes: Strict CSP (self, Vercel Blob, YouTube, Sentry tunnel, unsafe-inline for styles)
   - Admin routes: Permissive CSP (unsafe-eval, unsafe-inline for Payload admin)
   - Headers: Content-Security-Policy, X-Frame-Options, Strict-Transport-Security, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control

2. **Frontend Error Boundary** — `src/app/(frontend)/error.tsx`
   - Create new file with 'use client' directive
   - UseEffect to capture exception to Sentry
   - Locale-aware text (Hebrew/English)
   - "Try again" button calling reset()
   - Tailwind styling

3. **Env Variable Validation** — `src/infra/config/env-validation.ts`
   - Create Zod schema for required env vars
   - Required: DATABASE_URL, PAYLOAD_SECRET, BLOB_READ_WRITE_TOKEN
   - Optional with warning: SENTRY_DSN, OPENAI_API_KEY, GEMINI_API_KEY, GITHUB_TOKEN
   - Public: NEXT_PUBLIC_SERVER_URL, NEXT_PUBLIC_SENTRY_DSN

4. **Pre-launch E2E Cherry-pick**
   - Cherry-pick commit 9631fe7b from feat/pre-launch-e2e-verification
   - Contains test helpers and 8 spec files

### Phase 2: Sentry Coverage

5a. **Enhance handleCodyApiError utility**
   - Add Sentry.captureException call to fix all 20 Cody routes

5b. **Add captureAndRespond to 6 non-Cody routes**
   - conversations/by-context, blob/upload-token, jobs/run-immediate, pdfjs-viewer, copilotkit, agent/message/persist

5c. **Migrate 4 routes to withApiHandler**
   - agent/chat, agent/chat/stream, exercises/import, exercises/validate-answer

### Phase 3: Infrastructure

6. **Zod Validation for Remaining Routes**
   - api/agent/conversation, api/agent/reset-chat, api/cody/tasks POST, api/cody/tasks/approve-review

7. **CI Coverage Enforcement**
   - Add --coverage to pnpm test:unit in ci.yml
   - Upload coverage artifact
   - Add coverage config to vitest.config.unit.mts

8. **Web Vitals Tracking**
   - Add Sentry.browserTracingIntegration() to instrumentation-client.ts

## Acceptance Criteria

- [ ] Security headers visible in browser devtools
- [ ] Frontend error boundary catches and reports errors
- [ ] Missing required env vars fail at startup
- [ ] E2E tests run successfully
- [ ] Sentry captures errors from all API routes
- [ ] Zod validation rejects invalid input
- [ ] Coverage reports generated and uploaded
- [ ] Web Vitals appear in Sentry
- [ ] All verification commands pass: tsc, vitest, lint
