# QA Implementation Plan — Implementation Plan

## Phase 1: Critical Items (Commit Together)

### 1. Security Headers — next.config.js

**Steps:**
1. Read existing `next.config.js`
2. Add `async headers()` export function
3. Implement split CSP strategy:
   - All routes: strict CSP with self, Vercel Blob, YouTube, Sentry tunnel, unsafe-inline (styles only)
   - Admin routes: permissive CSP with unsafe-eval, unsafe-inline
4. Add other security headers (X-Frame-Options, HSTS, etc.)

**File:** `next.config.js`

---

### 2. Frontend Error Boundary

**Steps:**
1. Read reference files: `src/app/global-error.tsx`, `src/app/(cody)/cody/error.tsx`
2. Create `src/app/(frontend)/error.tsx`
3. Add 'use client' directive
4. Implement error handling with useEffect + Sentry.captureException
5. Add locale-aware text (Hebrew/English)
6. Add "Try again" button with reset() call
7. Apply Tailwind styling

**File:** `src/app/(frontend)/error.tsx` (CREATE)

---

### 3. Env Variable Validation

**Steps:**
1. Create `src/infra/config/env-validation.ts`
2. Define Zod schema with required vars (DATABASE_URL, PAYLOAD_SECRET, BLOB_READ_WRITE_TOKEN)
3. Define optional vars with warnings (SENTRY_DSN, OPENAI_API_KEY, GEMINI_API_KEY, GITHUB_TOKEN)
4. Define public vars (NEXT_PUBLIC_SERVER_URL, NEXT_PUBLIC_SENTRY_DSN)
5. Create validateEnv() function
6. Read `instrumentation.ts` and add validateEnv() call in register()

**Files:** 
- `src/infra/config/env-validation.ts` (CREATE)
- `instrumentation.ts` (EDIT)

---

### 4. Pre-launch E2E Cherry-pick

**Steps:**
1. Run: `git cherry-pick 9631fe7b` from feat/pre-launch-e2e-verification branch
2. If conflicts: resolve manually, keeping dev branch patterns
3. Verify cherry-pick succeeds

---

## Phase 2: Sentry Coverage (Commit Together)

### 5a. Enhance handleCodyApiError utility

**Steps:**
1. Find handleCodyApiError utility in codebase
2. Add Sentry.captureException call in the error handler
3. Verify this fixes all Cody routes

### 5b. Add captureAndRespond to 6 routes

**Steps:**
1. Find/create captureAndRespond utility
2. Update each route:
   - `api/conversations/by-context/route.ts`
   - `api/blob/upload-token/route.ts`
   - `api/jobs/run-immediate/route.ts`
   - `api/pdfjs-viewer/route.ts`
   - `api/copilotkit/route.ts`
   - `api/agent/message/persist/route.ts`
3. Replace catch blocks with captureAndRespond calls

### 5c. Migrate 4 routes to withApiHandler

**Steps:**
1. Find withApiHandler utility
2. For each route:
   - `api/agent/chat/route.ts`
   - `api/agent/chat/stream/route.ts`
   - `api/exercises/import/route.ts`
   - `api/exercises/validate-answer/route.ts`
3. Create Zod schema for input validation
4. Migrate to withApiHandler pattern
5. Add Sentry integration

---

## Phase 3: Infrastructure (Commit Together)

### 6. Zod Validation for Remaining Routes

**Steps:**
1. `api/agent/conversation/route.ts` — add Zod for contextKey, exerciseId
2. `api/agent/reset-chat/route.ts` — add Zod for contextKey
3. `api/cody/tasks/route.ts` — add Zod for POST task creation
4. `api/cody/tasks/approve-review/route.ts` — add Zod for PR number, task ID

### 7. CI Coverage Enforcement

**Steps:**
1. Read `.github/workflows/ci.yml`
2. Add `--coverage --reporter=json --reporter=html` to test:unit step
3. Add artifact upload for coverage report (retention-days: 7)
4. Read `vitest.config.unit.mts`
5. Add coverage section with provider: 'v8', thresholds, reporters

**Files:**
- `.github/workflows/ci.yml`
- `vitest.config.unit.mts`

### 8. Web Vitals Tracking

**Steps:**
1. Read `src/infra/instrumentation-client.ts`
2. Add `Sentry.browserTracingIntegration()` to integrations array
3. Ensure replayIntegration is already present

**File:** `src/infra/instrumentation-client.ts`

---

## Verification

Run after each phase:
```bash
pnpm -s tsc --noEmit
pnpm vitest run --config vitest.config.unit.mts
pnpm lint
```
