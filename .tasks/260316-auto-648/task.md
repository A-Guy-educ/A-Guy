# Task

## Issue Title

# QA Implementation Plan — Critical + High Priority
# QA Implementation Plan — Critical + High Priority

**Date**: 2026-03-14  
**Branch**: dev (commit directly — no feature branch)  
**Context**: Following the pipeline simplification (complete) and full QA audit (complete).

---

## Background

The QA audit identified 15 areas of concern. This plan covers all **Critical** and **High Priority** items only.

### Audit Summary

| Area | Grade | Status |
|---|---|---|
| Security Headers | D | ❌ No CSP, X-Frame-Options, HSTS, etc. in next.config.js |
| Frontend Error Boundary | C | ❌ Missing error.tsx in (frontend) route group |
| Env Variable Validation | F | ❌ No startup-time validation at all |
| Pre-launch E2E Tests | — | ❌ On diverged branch (feat/pre-launch-e2e-verification) |
| Sentry Capture in API Routes | C | ❌ 30 routes with catch blocks but no Sentry reporting |
| Zod Validation in API Routes | C+ | ❌ 21 POST routes without Zod input validation |
| CI Coverage Enforcement | — | ❌ No --coverage flag, no thresholds |
| Web Vitals Tracking | C- | ❌ Sentry installed but browserTracingIntegration not configured |

---

## Phase 1: Critical Items (commit together)

### 1. Security Headers — `next.config.js`

Add `async headers()` function with **split CSP** strategy:
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

**File**: `next.config.js`

---

### 2. Frontend Error Boundary — `src/app/(frontend)/error.tsx`

CREATE new file. Mirror the existing `global-error.tsx` pattern:
- `'use client'` directive
- `useEffect` → `Sentry.captureException(error)`
- Locale-aware text (Hebrew/English via `navigator.language`)
- "Try again" button calling `reset()`
- Tailwind styling consistent with design system

**Reference**: `src/app/global-error.tsx`, `src/app/(cody)/cody/error.tsx`  
**File**: `src/app/(frontend)/error.tsx` (CREATE)

---

### 3. Env Variable Validation — `src/infra/config/env-validation.ts`

CREATE Zod schema for all required env vars. Called from `instrumentation.ts` at startup.

Required env vars to validate:
- **Server-only**: `DATABASE_URL`, `PAYLOAD_SECRET`, `BLOB_READ_WRITE_TOKEN`
- **Optional but logged if missing**: `SENTRY_DSN`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GITHUB_TOKEN`
- **Public**: `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_SENTRY_DSN`

Strategy: `z.string().min(1)` for required vars. Log a warning (not throw) for optional vars so dev starts without all keys.

**Files**: 
- `src/infra/config/env-validation.ts` (CREATE)
- `instrumentation.ts` (EDIT — call validateEnv() in register() for nodejs runtime)

---

### 4. Pre-launch E2E Cherry-pick

Cherry-pick commit `9631fe7b` from `feat/pre-launch-e2e-verification` branch.

Contains:
- `tests/e2e/helpers/admin.ts` — exercise seeding helpers
- `tests/e2e/helpers/exercise-builders.ts` — content builders
- `tests/e2e/helpers/verification-fixtures.ts` — shared fixtures + loginAsStudent/loginAsAdmin
- 8 spec files in `tests/e2e/verification/`: auth-onboarding, catalog-navigation, lesson-content, exercises, student-support, admin-content, admin-editing, admin-settings

If cherry-pick has conflicts: resolve manually, keeping dev branch patterns.

---

## Phase 2: Sentry Coverage (commit together)

### 5a. Enhance `handleCodyApiError` utility

Find the Cody API error utility and add `Sentry.captureException` call. This fixes all 20 Cody dashboard routes at once.

Routes fixed by this change:
- `/api/cody/remote/exec`, `/api/cody/remote/status`
- `/api/cody/chat`, `/api/cody/tasks`, `/api/cody/tasks/[taskId]`
- `/api/cody/tasks/[taskId]/actions`, `/api/cody/tasks/[taskId]/docs`
- `/api/cody/prs/comments`, `/api/cody/prs`, `/api/cody/prs/files`, `/api/cody/prs/status`
- `/api/cody/workflows`, `/api/cody/pipeline/[taskId]`
- `/api/cody/boards`, `/api/cody/collaborators`
- `/api/cody/tasks/approve`, `/api/cody/tasks/approve-review`
- `/api/cody/publish`
- `/api/cody/chat/save`, `/api/cody/chat/load`

### 5b. Add `captureAndRespond` to 6 non-Cody routes

Add `import { captureAndRespond }` + replace `catch` blocks to call it:

| Route | Current catch behavior |
|---|---|
| `api/conversations/by-context` | `console.error` + NextResponse |
| `api/blob/upload-token` | `console.error` + NextResponse |
| `api/jobs/run-immediate` | `console.error` + NextResponse |
| `api/pdfjs-viewer` | `console.error` + NextResponse |
| `api/copilotkit` | `console.error` + NextResponse |
| `api/agent/message/persist` | `logger.error` + NextResponse |

### 5c. Migrate 4 high-traffic routes to `withApiHandler`

Full Zod schema + Sentry + structured logging via `withApiHandler`:

| Route | Current issues |
|---|---|
| `api/agent/chat` | No Zod, no Sentry, manual field checks |
| `api/agent/chat/stream` | No Zod, no Sentry, manual field checks |
| `api/exercises/import` | No Zod, no Sentry |
| `api/exercises/validate-answer` | No Zod, no Sentry |

---

## Phase 3: Infrastructure (commit together)

### 6. Zod Validation for Remaining Routes

Add Zod schemas to remaining POST routes that accept user-controlled input but lack validation.

Priority order (by risk):
1. `api/agent/conversation` — accepts `contextKey`, `exerciseId` body fields
2. `api/agent/reset-chat` — accepts `contextKey` body field
3. `api/cody/tasks` POST — accepts task creation params
4. `api/cody/tasks/approve-review` — accepts PR number + task ID

Cody admin-only routes (lower priority, behind auth): add Zod but can be basic schemas.

### 7. CI Coverage Enforcement — `.github/workflows/ci.yml`

Changes to `ci.yml`:
1. Add `--coverage --reporter=json --reporter=html` to `pnpm test:unit` step
2. Upload coverage report as artifact (retention-days: 7)

Changes to `vitest.config.unit.mts`:
1. Add `coverage` section with `provider: 'v8'`, thresholds at current baseline (permissive to start)
2. Set `reporter: ['text', 'json', 'html']`

**Goal**: Visibility now, enforcement later.

### 8. Web Vitals Tracking — `src/infra/instrumentation-client.ts`

Add `Sentry.browserTracingIntegration()` to the `integrations` array alongside the existing `replayIntegration`.

This automatically captures:
- **LCP** (Largest Contentful Paint)
- **FID** / **INP** (Interaction to Next Paint)
- **CLS** (Cumulative Layout Shift)
- **TTFB** (Time to First Byte)
- **FCP** (First Contentful Paint)

Sampled at the existing `tracesSampleRate: 0.1` (10%).

---

## Verification (after each phase)

```bash
pnpm -s tsc --noEmit
pnpm vitest run --config vitest.config.unit.mts
pnpm lint
```

---

## Files Modified / Created

### Phase 1
- `next.config.js` — Add headers() with split CSP
- `src/app/(frontend)/error.tsx` — CREATE
- `src/infra/config/env-validation.ts` — CREATE
- `instrumentation.ts` — Hook in env validation

### Phase 2
- Cody error utility (TBD path — find handleCodyApiError)
- `src/app/api/conversations/by-context/route.ts`
- `src/app/api/blob/upload-token/route.ts`
- `src/app/api/jobs/run-immediate/route.ts`
- `src/app/api/pdfjs-viewer/route.ts`
- `src/app/api/copilotkit/route.ts`
- `src/app/api/agent/message/persist/route.ts`
- `src/app/api/agent/chat/route.ts` — migrate to withApiHandler
- `src/app/api/agent/chat/stream/route.ts` — migrate to withApiHandler
- `src/app/api/exercises/import/route.ts` — migrate to withApiHandler
- `src/app/api/exercises/validate-answer/route.ts` — migrate to withApiHandler

### Phase 3
- `src/app/api/agent/conversation/route.ts` — add Zod
- `src/app/api/agent/reset-chat/route.ts` — add Zod
- `src/app/api/cody/tasks/route.ts` — add Zod for POST
- `src/app/api/cody/tasks/approve-review/route.ts` — add Zod
- `.github/workflows/ci.yml` — add coverage
- `vitest.config.unit.mts` — add coverage config
- `src/infra/instrumentation-client.ts` — add browserTracingIntegration

---

## Decisions Made

- **Branch**: Work directly on `dev` (no feature branch)
- **Cody routes**: Enhance `handleCodyApiError` utility (fixes all 20 at once) rather than migrating individually
- **CSP strategy**: Split — strict for frontend routes, permissive for `/admin/*`
- **E2E tests**: Cherry-pick `9631fe7b` (not full branch merge — too much divergence)
- **Coverage thresholds**: Permissive initially (visibility > blocking)
- **Optional env vars**: Warn (don't throw) so dev starts without all keys


---
_Created by @aguyaharonyair via Cody dashboard_
