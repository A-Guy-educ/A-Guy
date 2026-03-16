# QA Implementation Plan — Implementation Steps

## Phase 1: Critical Items

### 1. Security Headers

**File: `next.config.js`**

Implementation Steps:
1. Read existing next.config.js
2. Add async headers() function
3. Define strict CSP for `/*`
4. Define permissive CSP for `/admin/*`
5. Add all required headers (X-Frame-Options, HSTS, etc.)

### 2. Frontend Error Boundary

**File: `src/app/(frontend)/error.tsx` (CREATE)**

Implementation Steps:
1. Read `src/app/global-error.tsx` for reference
2. Read `src/app/(cody)/cody/error.tsx` for reference
3. Create new error.tsx with client directive
4. Add Sentry capture in useEffect
5. Add locale detection for Hebrew/English
6. Add Try again button with reset()
7. Apply Tailwind styling

### 3. Env Variable Validation

**Files: `src/infra/config/env-validation.ts` (CREATE), `instrumentation.ts` (EDIT)**

Implementation Steps:
1. Create Zod schema for all required env vars
2. Implement validateEnv() function
3. Handle required vs optional vars differently
4. Edit instrumentation.ts to call validateEnv() in register()

### 4. Pre-launch E2E Cherry-pick

**Action: Git cherry-pick**

Implementation Steps:
1. Fetch and checkout feat/pre-launch-e2e-verification branch
2. Cherry-pick commit 9631fe7b
3. Resolve any conflicts manually
4. Keep dev branch patterns when resolving

## Phase 2: Sentry Coverage

### 5a. Enhance handleCodyApiError

**File: Find and edit handleCodyApiError utility**

Implementation Steps:
1. Search for handleCodyApiError in codebase
2. Add Sentry.captureException(error) call

### 5b. Add captureAndRespond to 6 routes

**Files: Multiple API route files**

Implementation Steps:
1. For each route, add import for captureAndRespond
2. Replace catch blocks to call captureAndRespond

### 5c. Migrate 4 routes to withApiHandler

**Files: api/agent/chat, api/agent/chat/stream, api/exercises/import, api/exercises/validate-answer**

Implementation Steps:
1. Search for withApiHandler utility
2. Create Zod schemas for each route
3. Migrate route handlers to use withApiHandler

## Phase 3: Infrastructure

### 6. Zod Validation for Remaining Routes

**Files: api/agent/conversation, api/agent/reset-chat, api/cody/tasks, api/cody/tasks/approve-review**

Implementation Steps:
1. Create Zod schemas for each route's input
2. Add validation to POST handlers

### 7. CI Coverage Enforcement

**Files: .github/workflows/ci.yml, vitest.config.unit.mts**

Implementation Steps:
1. Edit ci.yml: Add --coverage flags to test:unit step
2. Add artifact upload for coverage reports
3. Edit vitest.config.unit.mts: Add coverage section with v8 provider

### 8. Web Vitals Tracking

**File: src/infra/instrumentation-client.ts**

Implementation Steps:
1. Find existing Sentry configuration
2. Add browserTracingIntegration() to integrations array
3. Keep existing replayIntegration

## Verification

Run after each phase:
```bash
pnpm -s tsc --noEmit
pnpm vitest run --config vitest.config.unit.mts
pnpm lint
```
