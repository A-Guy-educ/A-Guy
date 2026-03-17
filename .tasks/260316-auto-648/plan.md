# QA Implementation Plan — Implementation Steps

## Phase 1: Critical Items

### Step 1: Security Headers

**File: next.config.js**
1. Add async headers() function
2. Configure split CSP strategy
3. Add all required security headers
4. Apply strict CSP to /* routes
5. Apply permissive CSP to /admin/* routes

### Step 2: Frontend Error Boundary

**File: src/app/(frontend)/error.tsx (CREATE)**
1. Add 'use client' directive
2. Import Sentry and useEffect
3. Create error boundary component
4. Add locale-aware text (Hebrew/English)
5. Add "Try again" button with reset()
6. Apply Tailwind styling

**Reference: src/app/global-error.tsx, src/app/(cody)/cody/error.tsx**

### Step 3: Environment Variable Validation

**File: src/infra/config/env-validation.ts (CREATE)**
1. Create Zod schema for required vars
2. Create Zod schema for optional vars (warn only)
3. Create Zod schema for public vars
4. Export validateEnv() function

**File: instrumentation.ts (EDIT)**
1. Import validateEnv from env-validation.ts
2. Call validateEnv() in register() for nodejs runtime

### Step 4: Pre-launch E2E Cherry-pick

1. Cherry-pick commit 9631fe7b from feat/pre-launch-e2e-verification
2. Resolve any conflicts manually
3. Keep dev branch patterns

---

## Phase 2: Sentry Coverage

### Step 5a: Cody API Error Utility

1. Find handleCodyApiError utility in codebase
2. Add Sentry.captureException call
3. This fixes all 20 Cody dashboard routes

### Step 5b: Non-Cody Routes

Add captureAndRespond to:
- src/app/api/conversations/by-context/route.ts
- src/app/api/blob/upload-token/route.ts
- src/app/api/jobs/run-immediate/route.ts
- src/app/api/pdfjs-viewer/route.ts
- src/app/api/copilotkit/route.ts
- src/app/api/agent/message/persist/route.ts

For each:
1. Import captureAndRespond
2. Replace catch blocks to call captureAndRespond

### Step 5c: High-Traffic Routes

Migrate to withApiHandler:
- src/app/api/agent/chat/route.ts
- src/app/api/agent/chat/stream/route.ts
- src/app/api/exercises/import/route.ts
- src/app/api/exercises/validate-answer/route.ts

For each:
1. Add full Zod schema
2. Add Sentry capture
3. Add structured logging
4. Use withApiHandler wrapper

---

## Phase 3: Infrastructure

### Step 6: Zod Validation for Remaining Routes

Add Zod schemas to:
- src/app/api/agent/conversation/route.ts
- src/app/api/agent/reset-chat/route.ts
- src/app/api/cody/tasks/route.ts (POST)
- src/app/api/cody/tasks/approve-review/route.ts

### Step 7: CI Coverage Enforcement

**File: .github/workflows/ci.yml**
1. Add --coverage --reporter=json --reporter=html to pnpm test:unit
2. Upload coverage report as artifact (retention-days: 7)

**File: vitest.config.unit.mts**
1. Add coverage section with provider: 'v8'
2. Set thresholds at current baseline (permissive)
3. Set reporter: ['text', 'json', 'html']

### Step 8: Web Vitals Tracking

**File: src/infra/instrumentation-client.ts**
1. Add Sentry.browserTracingIntegration() to integrations array
2. Keep existing replayIntegration
3. Sampled at tracesSampleRate: 0.1 (10%)

---

## Verification

After each phase, run:
```bash
pnpm -s tsc --noEmit
pnpm vitest run --config vitest.config.unit.mts
pnpm lint
```
