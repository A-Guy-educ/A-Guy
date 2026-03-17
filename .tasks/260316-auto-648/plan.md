# QA Implementation Plan — Implementation Steps

## Phase 1: Critical Items

### Step 1: Add Security Headers to next.config.js

1. Open `next.config.js`
2. Add `async headers()` function with split CSP strategy
3. For all routes (`/*`):
   - Add strict CSP: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://*.vercel-storage.com https://*.youtube.com; connect-src 'self' https://*.vercel-storage.com https://*.sentry.io;`
   - Add `X-Frame-Options: DENY`
   - Add `Strict-Transport-Security: max-age=31536000; includeSubDomains`
   - Add `X-Content-Type-Options: nosniff`
   - Add `Referrer-Policy: strict-origin-when-cross-origin`
   - Add `Permissions-Policy: camera=(), microphone=(), geolocation=()`
   - Add `X-DNS-Prefetch-Control: on`
4. For admin routes (`/admin/*`):
   - Add permissive CSP: `script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';`
   - Add same security headers

### Step 2: Create Frontend Error Boundary

1. Create `src/app/(frontend)/error.tsx`
2. Add `'use client'` directive
3. Import `Sentry` from `@sentry/nextjs`
4. Create component with:
   - `useEffect` to capture exception to Sentry
   - Locale detection via `navigator.language`
   - Hebrew/English error messages
   - "Try again" button calling `reset()`
   - Tailwind styling matching design system

### Step 3: Create Environment Validation

1. Create `src/infra/config/env-validation.ts`
2. Define Zod schema with:
   - Required: `DATABASE_URL`, `PAYLOAD_SECRET`, `BLOB_READ_WRITE_TOKEN`
   - Optional (warn only): `SENTRY_DSN`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GITHUB_TOKEN`
   - Public: `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_SENTRY_DSN`
3. Create `validateEnv()` function that:
   - Validates required vars with `z.string().min(1)`
   - Logs warnings for optional vars without throwing
4. Open `instrumentation.ts`
5. Import and call `validateEnv()` in `register()` function for nodejs runtime

### Step 4: Cherry-pick E2E Tests

1. Run: `git cherry-pick 9631fe7b` from `feat/pre-launch-e2e-verification` branch
2. If conflicts arise:
   - Resolve manually keeping dev branch patterns
   - Focus on test helpers and verification specs

---

## Phase 2: Sentry Coverage

### Step 5a: Find and Enhance Cody Error Utility

1. Search codebase for `handleCodyApiError`
2. Add `Sentry.captureException(error)` to the utility
3. Verify all 20 Cody routes will now report errors

### Step 5b: Add captureAndRespond to Non-Cody Routes

For each route, add import and replace catch block:

1. `api/conversations/by-context/route.ts`
2. `api/blob/upload-token/route.ts`
3. `api/jobs/run-immediate/route.ts`
4. `api/pdfjs-viewer/route.ts`
5. `api/copilotkit/route.ts`
6. `api/agent/message/persist/route.ts`

### Step 5c: Migrate High-Traffic Routes to withApiHandler

For each route, create Zod schema and wrap handler:

1. `api/agent/chat/route.ts`
2. `api/agent/chat/stream/route.ts`
3. `api/exercises/import/route.ts`
4. `api/exercises/validate-answer/route.ts`

---

## Phase 3: Infrastructure

### Step 6: Add Zod Validation to Remaining Routes

Add Zod schemas to:

1. `api/agent/conversation/route.ts` — validate `contextKey`, `exerciseId`
2. `api/agent/reset-chat/route.ts` — validate `contextKey`
3. `api/cody/tasks/route.ts` — validate task creation params (POST)
4. `api/cody/tasks/approve-review/route.ts` — validate PR number + task ID

### Step 7: Add CI Coverage

1. Open `.github/workflows/ci.yml`
2. Modify `pnpm test:unit` step:
   - Add `--coverage --reporter=json --reporter=html`
3. Add step to upload coverage report as artifact (retention-days: 7)
4. Open `vitest.config.unit.mts`
5. Add `coverage` section:
   - `provider: 'v8'`
   - `reporter: ['text', 'json', 'html']`
   - Set permissive thresholds

### Step 8: Add Web Vitals Tracking

1. Open `src/infra/instrumentation-client.ts`
2. Find `integrations` array with `replayIntegration`
3. Add `browserTracingIntegration()` to the array

---

## Verification

After completing all phases, run:

```bash
pnpm -s tsc --noEmit
pnpm vitest run --config vitest.config.unit.mts
pnpm lint
```

## Files Summary

### Phase 1 (4 files)
- `next.config.js` — Add headers()
- `src/app/(frontend)/error.tsx` — CREATE
- `src/infra/config/env-validation.ts` — CREATE
- `instrumentation.ts` — Edit

### Phase 2 (11 files)
- Cody error utility — Edit
- 6 non-Cody routes — Edit
- 4 high-traffic routes — Migrate

### Phase 3 (7 files)
- 4 API routes — Add Zod
- `.github/workflows/ci.yml` — Edit
- `vitest.config.unit.mts` — Edit
- `src/infra/instrumentation-client.ts` — Edit
