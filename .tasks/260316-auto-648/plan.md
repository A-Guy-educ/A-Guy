# Plan: 260316-auto-648 — QA Implementation Plan (Critical + High Priority)

## Rerun Context

The previous run completed the build but failed at the commit stage: "Committed (f1e6d58) but push failed after rebase." The commit was lost during the failed rebase. This is a fresh re-implementation of the same plan. All source files are in their original (unmodified) state.

**Key discovery**: The E2E tests (Item 4 in spec) have already been merged via PR #784. The `tests/e2e/verification/` folder with all 8 spec files already exists. This step is **SKIPPED**.

## Research Findings

- `next.config.js` ✅ exists — no `headers()` function present (line 80-81, needs insertion before `reactStrictMode`)
- `src/app/(frontend)/error.tsx` 🆕 will create — parent dir exists
- `src/infra/config/env-validation.ts` 🆕 will create — parent dir `src/infra/config/` exists with 6 other files
- `instrumentation.ts` ✅ exists — 13 lines, needs env validation call in nodejs block
- `src/infra/instrumentation-client.ts` ✅ exists — 27 lines, missing `browserTracingIntegration`
- `src/ui/cody/github-error-handler.ts` ✅ exists — 127 lines, uses `console.error` only, no Sentry import
- `src/server/api/capture-and-respond.ts` ✅ exists — utility with `Sentry.captureException` pattern
- `src/server/api/with-api-handler.ts` ✅ exists — wrapper pattern with Zod + Sentry + auth
- `.github/workflows/ci.yml` ✅ exists — line 66 runs `pnpm test:unit` (no --coverage)
- `vitest.config.unit.mts` ✅ exists — already has full coverage config (provider v8, thresholds)
- `package.json` ✅ has `test:unit:coverage` script already defined
- `tests/e2e/verification/` ✅ already exists — 8 spec files merged via PR #784

**Patterns observed:**
- Error boundary pattern: `src/app/global-error.tsx` — 'use client', Sentry.captureException in useEffect, Hebrew/English locale detection, Tailwind styling
- `captureAndRespond` pattern: import + call in catch blocks — `captureAndRespond(error, { route: '...' })`
- `withApiHandler` pattern: `export const POST = withApiHandler<TBody, TQuery>({ auth, bodySchema }, async (ctx) => { ... })`
- Cody routes use `handleCodyApiError(error, routeName)` — currently calls `console.error`, no Sentry

**Integration points:**
- `handleCodyApiError` is imported by 14+ Cody API routes — single change fixes all
- `instrumentation.ts` register() runs at Node.js startup — env validation goes here
- Vitest already has coverage config — CI just needs `--coverage` flag (or use `test:unit:coverage` script)

## Reuse Inventory

| Existing Utility | Import Path | Used In |
|---|---|---|
| `captureAndRespond` | `@/server/api/capture-and-respond` | Steps 5-6 (6 non-Cody routes) |
| `withApiHandler` | `@/server/api/with-api-handler` | Step 7 (4 high-traffic routes) |
| `handleCodyApiError` | `@/ui/cody/github-error-handler` | Step 4 (add Sentry to it) |
| `Sentry.*` | `@sentry/nextjs` | Steps 2, 4, 5, 6, 7, 8, 10 |
| `logger` | `@/infra/utils/logger/logger` | Already in most routes |
| `z` from `zod` | `zod` | Steps 3, 7, 8 |
| Global error pattern | `src/app/global-error.tsx` | Step 2 reference |
| `test:unit:coverage` script | `package.json` | Step 9 CI change |

**New utilities (justified):**
- `src/infra/config/env-validation.ts` — No existing env validation exists anywhere in codebase. Required by spec FR-003.

---

## Steps

### Step 1: Security Headers in next.config.js
**Spec**: FR-001 (Phase 1 - Critical)

**Files to Touch**:
- `next.config.js` (MODIFIED — insert `async headers()` function into `nextConfig` object, between line 81 and `reactStrictMode`)

**Exact Behavior**:
Add `async headers()` returning an array with two entries:
1. `source: '/((?!admin).*)` — Strict CSP for all non-admin routes:
   - `Content-Security-Policy`: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.blob.vercel-storage.com https://img.youtube.com https://avatars.githubusercontent.com; connect-src 'self' https://*.blob.vercel-storage.com /monitoring https://*.sentry.io; font-src 'self'; frame-src https://www.youtube.com https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; form-action 'self'`
   - `X-Frame-Options`: `DENY`
   - `Strict-Transport-Security`: `max-age=31536000; includeSubDomains`
   - `X-Content-Type-Options`: `nosniff`
   - `Referrer-Policy`: `strict-origin-when-cross-origin`
   - `Permissions-Policy`: `camera=(), microphone=(), geolocation=()`
   - `X-DNS-Prefetch-Control`: `on`
2. `source: '/admin/:path*'` — Permissive CSP for Payload admin:
   - `Content-Security-Policy`: `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.blob.vercel-storage.com; connect-src 'self' https://*.blob.vercel-storage.com /monitoring https://*.sentry.io; font-src 'self'; frame-src 'self'; object-src 'none'`
   - Same non-CSP security headers as above

**Tests** (FAIL before, PASS after):
- Test location: `tests/unit/config/security-headers.spec.ts`
- Test 1: Import the headers function from next.config.js, verify it returns array with 2 entries
- Test 2: Verify strict CSP does NOT contain 'unsafe-eval'
- Test 3: Verify admin CSP contains 'unsafe-eval' and 'unsafe-inline'
- Test 4: Verify all 7 security headers are present in both route entries

**Acceptance**:
- [ ] `headers()` function exists in nextConfig
- [ ] Strict CSP applies to non-admin routes (no unsafe-eval)
- [ ] Admin CSP has unsafe-eval + unsafe-inline
- [ ] All 7 headers present: CSP, X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control

---

### Step 2: Frontend Error Boundary
**Spec**: FR-002 (Phase 1 - Critical)

**Files to Touch**:
- `src/app/(frontend)/error.tsx` (NEW)

**Exact Behavior**:
Create a client component that mirrors `src/app/global-error.tsx`:
- `'use client'` directive
- Imports: `* as Sentry` from `@sentry/nextjs`, `useEffect` from `react`
- Props: `{ error: Error & { digest?: string }, reset: () => void }`
- `useEffect` calls `Sentry.captureException(error)` when error changes
- Detect browser language: `navigator.language?.startsWith('he')` → Hebrew/English content
- Show heading + "Try again" button calling `reset()`
- Tailwind: `flex flex-col items-center justify-center min-h-screen p-5 text-center`
- Button: `mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 transition-colors`
- **Key difference from global-error.tsx**: No `<html>` / `<body>` wrapper (this is a nested error boundary within the layout)

**Tests** (FAIL before, PASS after):
- Test location: `tests/unit/config/frontend-error-boundary.spec.ts`
- Test 1: Component renders heading text and try again button
- Test 2: Sentry.captureException is called with the error
- Test 3: Hebrew content shows when navigator.language starts with 'he'

**Acceptance**:
- [ ] File exists at `src/app/(frontend)/error.tsx`
- [ ] Has 'use client' directive
- [ ] Calls Sentry.captureException in useEffect
- [ ] Locale-aware Hebrew/English text
- [ ] "Try again" button calls reset()

---

### Step 3: Env Variable Validation
**Spec**: FR-003 (Phase 1 - Critical)

**Files to Touch**:
- `src/infra/config/env-validation.ts` (NEW)
- `instrumentation.ts` (MODIFIED — lines 4-6, add env validation call)

**Exact Behavior**:

**env-validation.ts**:
- Import `z` from `zod`
- Define `serverEnvSchema` with required vars: `DATABASE_URL` (`z.string().min(1)`), `PAYLOAD_SECRET` (`z.string().min(1)`), `BLOB_READ_WRITE_TOKEN` (`z.string().min(1)`)
- Define `optionalEnvVars` array: `['SENTRY_DSN', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GITHUB_TOKEN']`
- Define `publicEnvSchema` with: `NEXT_PUBLIC_SERVER_URL` (`z.string().optional()`), `NEXT_PUBLIC_SENTRY_DSN` (`z.string().optional()`)
- Export `validateEnv()` function that:
  1. Parses `process.env` with `serverEnvSchema.parse()` — throws on missing required vars (stops app)
  2. Loops over `optionalEnvVars` — logs warning with `console.warn` for each missing one (does NOT throw)
  3. Parses public vars with `publicEnvSchema.parse()` — optional, warns if missing

**instrumentation.ts**:
- Inside the `if (process.env.NEXT_RUNTIME === 'nodejs')` block, after sentry import:
  - Import and call `validateEnv()` from `@/infra/config/env-validation`

**Tests** (FAIL before, PASS after):
- Test location: `tests/unit/config/env-validation.spec.ts`
- Test 1: `validateEnv()` throws when DATABASE_URL is missing
- Test 2: `validateEnv()` throws when PAYLOAD_SECRET is missing
- Test 3: `validateEnv()` throws when BLOB_READ_WRITE_TOKEN is missing
- Test 4: `validateEnv()` succeeds when all required vars present (does NOT throw)
- Test 5: `validateEnv()` logs warning for missing optional vars (does NOT throw)

**Acceptance**:
- [ ] `env-validation.ts` created with Zod schema
- [ ] Required vars throw on missing
- [ ] Optional vars log warning but don't throw
- [ ] `instrumentation.ts` calls `validateEnv()` in nodejs block

---

### Step 4: Enhance handleCodyApiError with Sentry
**Spec**: FR-005a (Phase 2 - Sentry Coverage)

**Files to Touch**:
- `src/ui/cody/github-error-handler.ts` (MODIFIED — add Sentry import at line 1, add captureException call before each `return` in `handleCodyApiError`)

**Exact Behavior**:
- Add `import * as Sentry from '@sentry/nextjs'` at top of file
- At the start of `handleCodyApiError` function (after line 75, the safeMessage extraction), add:
  ```
  Sentry.captureException(error, {
    tags: { route: `cody/${routeName}` },
  })
  ```
- This single change covers all 20+ Cody routes that call `handleCodyApiError`

**Tests** (FAIL before, PASS after):
- Test location: `tests/unit/cody-api-error-sentry.spec.ts`
- Test 1: `handleCodyApiError` calls `Sentry.captureException` for unknown errors
- Test 2: `handleCodyApiError` calls `Sentry.captureException` for OctokitError with 500 status
- Test 3: `handleCodyApiError` calls `Sentry.captureException` with correct route tag

**Acceptance**:
- [ ] Sentry import added
- [ ] Every error path calls `Sentry.captureException`
- [ ] All 20+ Cody routes now report to Sentry (no individual route changes needed)

---

### Step 5: Add captureAndRespond to 6 Non-Cody Routes
**Spec**: FR-005b (Phase 2 - Sentry Coverage)

**Files to Touch**:
- `src/app/api/conversations/by-context/route.ts` (MODIFIED — 3 catch blocks at lines 58, 120, 150)
- `src/app/api/blob/upload-token/route.ts` (MODIFIED — catch block at line 143)
- `src/app/api/jobs/run-immediate/route.ts` (MODIFIED — catch block at line 159)
- `src/app/api/pdfjs-viewer/route.ts` (MODIFIED — catch block at line 111)
- `src/app/api/copilotkit/route.ts` (MODIFIED — catch block at line 161)
- `src/app/api/agent/message/persist/route.ts` (MODIFIED — catch block at line 116)

**Exact Behavior**:
In each catch block, replace `console.error` / `logger.error` + NextResponse.json with:
```typescript
import { captureAndRespond } from '@/server/api/capture-and-respond'
// ...
} catch (error) {
  return captureAndRespond(error, { route: '/api/...' })
}
```

**Specific notes per route:**
- `conversations/by-context`: 3 handlers (GET at line 58, POST at line 120, DELETE at line 150) — each gets captureAndRespond
- `blob/upload-token`: Bare `catch {}` at line 143 — needs `(error)` parameter added
- `jobs/run-immediate`: Keep the inner try/catch for job status update, but add Sentry to outer catch
- `pdfjs-viewer`: Simple replacement
- `copilotkit`: Simple replacement
- `agent/message/persist`: Keep ZodError check (`if (error instanceof z.ZodError)` at line 112) — only add captureAndRespond to the else branch (non-validation errors)

**Tests** (FAIL before, PASS after):
- Test location: `tests/unit/api/sentry-coverage.spec.ts`
- Test 1: Verify `captureAndRespond` import exists in each of the 6 route files (static analysis / grep)
- (Integration-level validation happens via typecheck — if imports are wrong, tsc fails)

**Acceptance**:
- [ ] All 6 routes import and use `captureAndRespond`
- [ ] No `console.error` in catch blocks (replaced with captureAndRespond)
- [ ] Agent/message/persist still handles ZodError separately
- [ ] blob/upload-token catch has error parameter

---

### Step 6: Add Sentry to 4 High-Traffic Routes (catch blocks)
**Spec**: FR-005c (Phase 2 - Sentry Coverage)

**Files to Touch**:
- `src/app/api/agent/chat/route.ts` (MODIFIED — catch block at line 78)
- `src/app/api/agent/chat/stream/route.ts` (MODIFIED — catch block at line 88)
- `src/app/api/exercises/import/route.ts` (MODIFIED — catch block at line 48)
- `src/app/api/exercises/validate-answer/route.ts` (MODIFIED — catch block at line 29)

**Exact Behavior**:
**NOTE**: The spec says "migrate to withApiHandler" but these routes have complex patterns (they delegate to Payload endpoints via custom PayloadRequest objects). Full migration to withApiHandler would require refactoring the endpoint layer, which is risky and out of scope for a QA fix. Instead, **add Sentry.captureException to the existing catch blocks** — this achieves the same Sentry coverage goal with minimal risk.

For each route, add at the top:
```typescript
import * as Sentry from '@sentry/nextjs'
```

In each catch block, add before the return:
```typescript
Sentry.captureException(error, {
  tags: { route: '/api/...' },
  extra: { requestId },
})
```

This gives all 4 routes Sentry error reporting while preserving their existing behavior.

**Tests** (FAIL before, PASS after):
- Test location: `tests/unit/api/sentry-coverage.spec.ts` (same file as Step 5)
- Test 1: Verify `Sentry` import exists in each of the 4 route files
- (Typecheck validates correct usage)

**Acceptance**:
- [ ] All 4 routes import `@sentry/nextjs`
- [ ] All 4 routes call `Sentry.captureException` in catch blocks
- [ ] Existing behavior preserved (same response format, same status codes)

---

### Step 7: Zod Validation for 4 Remaining Routes
**Spec**: FR-006, FR-008 (Phase 3 - Infrastructure)

**Files to Touch**:
- `src/app/api/agent/conversation/route.ts` (MODIFIED — add Zod schema + Sentry)
- `src/app/api/agent/reset-chat/route.ts` (MODIFIED — add Zod schema + Sentry)
- `src/app/api/cody/tasks/route.ts` (MODIFIED — add Zod schema to POST handler)
- `src/app/api/cody/tasks/approve-review/route.ts` (MODIFIED — add Zod schema + Sentry)

**Exact Behavior**:

**agent/conversation**: Add `z.object({ contextKey: z.string().min(1), exerciseId: z.string().optional() })` schema. Parse body before the manual `if (!body.contextKey)` check (replace manual check with Zod). Add Sentry.captureException in catch block.

**agent/reset-chat**: Add `z.object({ contextKey: z.string().min(1) })` schema. Replace manual check. Add Sentry.captureException in catch block.

**cody/tasks POST**: Add basic Zod schema:
```typescript
const createTaskSchema = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
  labels: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional(),
  actorLogin: z.string().min(1),
  attachments: z.array(z.object({
    name: z.string(),
    content: z.string(),
  })).optional(),
})
```
Parse body with this schema. Keep existing handleCodyApiError in outer catch (it already has Sentry from Step 4).

**cody/tasks/approve-review**: Add basic Zod schema:
```typescript
const approveReviewSchema = z.object({
  prNumber: z.number().or(z.string().transform(Number)),
  actorLogin: z.string().min(1),
})
```
Parse body with this schema. Add Sentry to outer catch block.

**Tests** (FAIL before, PASS after):
- Test location: `tests/unit/api/route-zod-validation.spec.ts`
- Test 1: agent/conversation rejects body without contextKey (400 response)
- Test 2: agent/reset-chat rejects body without contextKey (400 response)
- Test 3: cody/tasks POST rejects body without title (400 response)
- Test 4: cody/tasks/approve-review rejects body without prNumber (400 response)

**Acceptance**:
- [ ] All 4 routes use Zod for input validation
- [ ] Invalid input returns 400 with validation error
- [ ] Valid input passes through unchanged
- [ ] Sentry coverage in catch blocks

---

### Step 8: CI Coverage Enforcement
**Spec**: FR-007 (Phase 3 - Infrastructure)

**Files to Touch**:
- `.github/workflows/ci.yml` (MODIFIED — line 66, change test command + add artifact upload step)

**Exact Behavior**:
1. Change line 66 from `run: pnpm test:unit` to `run: pnpm test:unit:coverage` (uses existing npm script that adds --coverage)
2. Add new step after the unit tests step:
```yaml
      - name: Upload coverage report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
          retention-days: 7
```

**NOTE**: `vitest.config.unit.mts` already has full coverage config (v8 provider, thresholds, reporters). No changes needed there.

**Tests** (FAIL before, PASS after):
- No unit test — this is a CI config change
- Verify via visual inspection of ci.yml

**Acceptance**:
- [ ] CI runs `pnpm test:unit:coverage` instead of `pnpm test:unit`
- [ ] Coverage report uploaded as artifact
- [ ] No changes to vitest.config.unit.mts (already configured)

---

### Step 9: Web Vitals Tracking
**Spec**: FR-008, FR-010 (Phase 3 - Infrastructure)

**Files to Touch**:
- `src/infra/instrumentation-client.ts` (MODIFIED — line 21, add browserTracingIntegration)

**Exact Behavior**:
Add `Sentry.browserTracingIntegration()` to the `integrations` array in `Sentry.init()`:

```typescript
integrations: [
  Sentry.replayIntegration({
    maskAllText: true,
    blockAllMedia: true,
  }),
  Sentry.browserTracingIntegration(),
],
```

This automatically captures LCP, FID/INP, CLS, TTFB, FCP at the existing `tracesSampleRate: 0.1` (10%).

**Tests** (FAIL before, PASS after):
- Test location: `tests/unit/config/instrumentation-client.spec.ts`
- Test 1: Verify `browserTracingIntegration` is called in Sentry.init integrations array
- (This is a config-level change — mocking Sentry to verify the call)

**Acceptance**:
- [ ] `browserTracingIntegration()` added to integrations array
- [ ] Existing replayIntegration preserved
- [ ] tracesSampleRate unchanged at 0.1

---

### Step 10: Quality Gates
**Spec**: Acceptance Criteria

**Files to Touch**: None (verification only)

**Exact Behavior**:
Run all quality gates:
```bash
pnpm -s tsc --noEmit
pnpm vitest run --config vitest.config.unit.mts
pnpm lint
```

**Acceptance**:
- [ ] TypeScript compiles with no errors
- [ ] All unit tests pass
- [ ] ESLint passes with no errors

---

## Step Dependencies

```
Step 1 (Security Headers) — independent
Step 2 (Error Boundary)   — independent
Step 3 (Env Validation)   — independent
Step 4 (Cody Sentry)      — independent
Step 5 (captureAndRespond)— independent
Step 6 (4 Route Sentry)   — independent
Step 7 (Zod Validation)   — depends on Step 4 (cody/tasks uses handleCodyApiError which gets Sentry)
Step 8 (CI Coverage)       — independent
Step 9 (Web Vitals)        — independent
Step 10 (Quality Gates)    — depends on ALL previous steps
```

## Skipped Items

- **Pre-launch E2E Tests (Spec Item 4)**: Already merged via PR #784. `tests/e2e/verification/` folder with all 8 spec files exists. No cherry-pick needed.
- **Full withApiHandler migration for 4 routes (Spec Item 5c)**: These routes delegate to Payload endpoints via custom PayloadRequest objects. Full migration would require refactoring the endpoint layer, adding significant risk. Instead, Step 6 adds Sentry.captureException directly to catch blocks, achieving the same Sentry coverage goal.
