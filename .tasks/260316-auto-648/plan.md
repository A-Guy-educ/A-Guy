# QA Implementation Plan — Implementation Steps

## Phase 1: Critical Items

### 1. Security Headers — `next.config.js`
1. Open `next.config.js`
2. Add `async headers()` function
3. Implement split CSP strategy:
   - All routes: strict CSP with self, Vercel Blob, YouTube, Sentry tunnel
   - Admin routes: permissive CSP with unsafe-eval, unsafe-inline
4. Add all required headers

### 2. Frontend Error Boundary — `src/app/(frontend)/error.tsx`
1. Create new file at `src/app/(frontend)/error.tsx`
2. Add 'use client' directive
3. Import Sentry and error types
4. Implement error component with useEffect for Sentry.captureException
5. Add locale-aware text
6. Add "Try again" button with reset()
7. Apply Tailwind styling

### 3. Env Variable Validation
1. Create `src/infra/config/env-validation.ts`
2. Define Zod schema for required vars (DATABASE_URL, PAYLOAD_SECRET, BLOB_READ_WRITE_TOKEN)
3. Define Zod schema for optional vars (SENTRY_DSN, OPENAI_API_KEY, GEMINI_API_KEY, GITHUB_TOKEN)
4. Define Zod schema for public vars (NEXT_PUBLIC_SERVER_URL, NEXT_PUBLIC_SENTRY_DSN)
5. Create validateEnv() function
6. Edit `instrumentation.ts` to call validateEnv() in register()

### 4. Pre-launch E2E Cherry-pick
1. Run `git cherry-pick 9631fe7b` from feat/pre-launch-e2e-verification
2. Resolve any conflicts manually
3. Verify cherry-pick succeeded

## Phase 2: Sentry Coverage

### 5a. Enhance handleCodyApiError utility
1. Find handleCodyApiError utility in codebase
2. Add Sentry.captureException call

### 5b. Add captureAndRespond to 6 routes
1. Find or create captureAndRespond utility
2. Edit each route:
   - `api/conversations/by-context/route.ts`
   - `api/blob/upload-token/route.ts`
   - `api/jobs/run-immediate/route.ts`
   - `api/pdfjs-viewer/route.ts`
   - `api/copilotkit/route.ts`
   - `api/agent/message/persist/route.ts`

### 5c. Migrate 4 routes to withApiHandler
1. Find withApiHandler utility
2. Edit each route:
   - `api/agent/chat/route.ts`
   - `api/agent/chat/stream/route.ts`
   - `api/exercises/import/route.ts`
   - `api/exercises/validate-answer/route.ts`
3. Add Zod schemas and integrate withApiHandler

## Phase 3: Infrastructure

### 6. Zod Validation for Remaining Routes
1. Edit `api/agent/conversation/route.ts` — add Zod for contextKey, exerciseId
2. Edit `api/agent/reset-chat/route.ts` — add Zod for contextKey
3. Edit `api/cody/tasks/route.ts` — add Zod for POST
4. Edit `api/cody/tasks/approve-review/route.ts` — add Zod

### 7. CI Coverage Enforcement
1. Edit `.github/workflows/ci.yml`:
   - Add `--coverage --reporter=json --reporter=html` to test:unit
   - Add coverage artifact upload step
2. Edit `vitest.config.unit.mts`:
   - Add coverage section with v8 provider
   - Add thresholds (permissive)
   - Configure reporters

### 8. Web Vitals Tracking
1. Open `src/infra/instrumentation-client.ts`
2. Add `Sentry.browserTracingIntegration()` to integrations array

## Verification

Run after each phase:
```bash
pnpm -s tsc --noEmit
pnpm vitest run --config vitest.config.unit.mts
pnpm lint
```

## Files to Modify

### Phase 1
- `next.config.js`
- `src/app/(frontend)/error.tsx` (CREATE)
- `src/infra/config/env-validation.ts` (CREATE)
- `instrumentation.ts`

### Phase 2
- Cody error utility (find path)
- `src/app/api/conversations/by-context/route.ts`
- `src/app/api/blob/upload-token/route.ts`
- `src/app/api/jobs/run-immediate/route.ts`
- `src/app/api/pdfjs-viewer/route.ts`
- `src/app/api/copilotkit/route.ts`
- `src/app/api/agent/message/persist/route.ts`
- `src/app/api/agent/chat/route.ts`
- `src/app/api/agent/chat/stream/route.ts`
- `src/app/api/exercises/import/route.ts`
- `src/app/api/exercises/validate-answer/route.ts`

### Phase 3
- `src/app/api/agent/conversation/route.ts`
- `src/app/api/agent/reset-chat/route.ts`
- `src/app/api/cody/tasks/route.ts`
- `src/app/api/cody/tasks/approve-review/route.ts`
- `.github/workflows/ci.yml`
- `vitest.config.unit.mts`
- `src/infra/instrumentation-client.ts`
