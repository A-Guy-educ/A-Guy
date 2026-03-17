# QA Implementation Plan — Implementation Steps

## Phase 1: Critical Items

### Step 1: Security Headers
- **File**: `next.config.js`
- **Action**: Add async `headers()` function with:
  - Split CSP (strict for `/*`, permissive for `/admin/*`)
  - All security headers (HSTS, X-Frame-Options, etc.)

### Step 2: Frontend Error Boundary
- **File**: `src/app/(frontend)/error.tsx` (CREATE)
- **Reference**: `src/app/global-error.tsx`, `src/app/(cody)/cody/error.tsx`
- **Action**: Create error.tsx with:
  - 'use client' directive
  - Sentry.captureException in useEffect
  - Locale-aware text
  - Reset button

### Step 3: Env Validation
- **File**: `src/infra/config/env-validation.ts` (CREATE)
- **File**: `instrumentation.ts` (EDIT)
- **Action**: 
  - Create Zod schema for all env vars
  - Hook into instrumentation.ts register() function

### Step 4: E2E Cherry-pick
- **Action**: Cherry-pick commit 9631fe7b from feat/pre-launch-e2e-verification
- **Resolve**: Any conflicts manually, keeping dev branch patterns

## Phase 2: Sentry Coverage

### Step 5a: Cody Error Utility
- **Find**: handleCodyApiError utility in codebase
- **Action**: Add Sentry.captureException call

### Step 5b: Non-Cody Routes
- **Files**:
  - `src/app/api/conversations/by-context/route.ts`
  - `src/app/api/blob/upload-token/route.ts`
  - `src/app/api/jobs/run-immediate/route.ts`
  - `src/app/api/pdfjs-viewer/route.ts`
  - `src/app/api/copilotkit/route.ts`
  - `src/app/api/agent/message/persist/route.ts`
- **Action**: Add captureAndRespond import and use in catch blocks

### Step 5c: High-traffic Routes
- **Files**:
  - `src/app/api/agent/chat/route.ts`
  - `src/app/api/agent/chat/stream/route.ts`
  - `src/app/api/exercises/import/route.ts`
  - `src/app/api/exercises/validate-answer/route.ts`
- **Action**: Migrate to withApiHandler pattern with Zod schema

## Phase 3: Infrastructure

### Step 6: Zod Validation
- **Files**:
  - `src/app/api/agent/conversation/route.ts`
  - `src/app/api/agent/reset-chat/route.ts`
  - `src/app/api/cody/tasks/route.ts`
  - `src/app/api/cody/tasks/approve-review/route.ts`
- **Action**: Add Zod schemas for POST body validation

### Step 7: CI Coverage
- **File**: `.github/workflows/ci.yml`
- **File**: `vitest.config.unit.mts`
- **Action**:
  - Add --coverage flags to test:unit
  - Add coverage artifact upload
  - Add coverage config to vitest

### Step 8: Web Vitals
- **File**: `src/infra/instrumentation-client.ts`
- **Action**: Add browserTracingIntegration() to integrations array

## Verification Commands

```bash
pnpm -s tsc --noEmit
pnpm vitest run --config vitest.config.unit.mts
pnpm lint
```
