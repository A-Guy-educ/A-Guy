# Plan: 260316-auto-648 — QA Implementation (Critical + High Priority)

## Rerun Context

This is a rerun (4th attempt). Previous runs failed before producing `build.md` / `review.md` artifacts. The rerun feedback is generic ("Rerun requested via /cody rerun"). This plan is built fresh from the spec, gap analysis, and thorough codebase research — consolidated to **8 actionable steps** with verified file paths and line numbers.

**Key changes from prior plan:**
- E2E cherry-pick (Spec §4) REMOVED — already merged via PR #784
- Step 6 (high-traffic routes) uses `Sentry.captureException` directly, NOT `withApiHandler` migration — downstream functions accept PayloadRequest objects, making full migration infeasible without deep refactoring
- `vitest.config.unit.mts` already has complete coverage config — only CI workflow needs `--coverage` flag
- `captureAndRespond` uses dynamic import pattern matching existing codebase convention

## Research Findings

### File Paths Verified
- `next.config.js` ✅ exists (103 lines, NO `headers()` function — needs adding)
- `src/app/global-error.tsx` ✅ exists (48 lines — reference pattern)
- `src/app/(frontend)/error.tsx` 🆕 will create
- `src/app/(frontend)/layout.tsx` ✅ exists (confirms route group)
- `src/infra/config/env-validation.ts` 🆕 will create
- `src/infra/config/server-init.ts` ✅ exists (reference for server-side init)
- `instrumentation.ts` ✅ exists (13 lines, needs env validation hook)
- `src/infra/instrumentation-client.ts` ✅ exists (27 lines, missing browserTracingIntegration)
- `src/ui/cody/github-error-handler.ts` ✅ exists (127 lines, NO Sentry import)
- `src/server/api/capture-and-respond.ts` ✅ exists (30 lines)
- `.github/workflows/ci.yml` ✅ exists (280 lines, `pnpm test:unit` on line 66)
- `vitest.config.unit.mts` ✅ exists (54 lines — already has full coverage config, NO changes needed)

### Patterns Observed
- **captureAndRespond usage**: Dynamic import `const { captureAndRespond } = await import('@/server/api/capture-and-respond')` — used in study-plan, chapters/by-grade, exercises/convert/runner, chat-assets/finalize
- **Error boundary**: `global-error.tsx` has `<html><body>` wrapper (root-level). Nested boundaries (`(cody)/cody/error.tsx`) do NOT include html/body tags.
- **next.config.js**: ESM format, config wrapped by `withPayload()` then `withSentryConfig()`
- **Sentry tunnel**: `tunnelRoute: '/monitoring'` means CSP connect-src needs `'self'` not `*.sentry.io` for frontend
- **handleCodyApiError**: No Sentry import, only console.error — needs `import * as Sentry` + `Sentry.captureException`
- **instrumentation.ts**: Uses relative imports (`./sentry.server.config`), NOT `@/` aliases

### Integration Points
- `instrumentation.ts` register() runs at Node.js startup — env validation goes here
- `handleCodyApiError` imported by 14+ Cody API routes — single Sentry addition covers all
- `next.config.js` → headers property added inside `nextConfig` object after `redirects`
- `src/infra/instrumentation-client.ts` → integrations array needs browserTracingIntegration

## Reuse Inventory

### Existing (will reuse)
- `captureAndRespond` from `src/server/api/capture-and-respond.ts`
- `handleCodyApiError` from `src/ui/cody/github-error-handler.ts` — enhance with Sentry
- `Sentry.*` from `@sentry/nextjs` — already project-wide
- `z` from `zod` — already imported in many files
- `logger` from `@/infra/utils/logger/logger`

### New (justification)
- `validateEnv()` from `src/infra/config/env-validation.ts` — NEW. No existing env validation anywhere. Zod is already used for input validation.

---

## Step 1: Security Headers — next.config.js (Spec §1)

**Files to Touch:**
- `next.config.js` (MODIFIED — insert `headers` async function into `nextConfig` object, after line 81 `redirects`)

**Exact Behavior:**
- Add `async headers()` function to `nextConfig` returning two header groups:
  1. **General routes (`/:path*`)** — Strict CSP:
     - `Content-Security-Policy`: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' *.blob.vercel-storage.com img.youtube.com avatars.githubusercontent.com data:; font-src 'self'; connect-src 'self'; frame-src 'self' www.youtube.com; object-src 'none'; base-uri 'self'; form-action 'self'`
     - `X-Frame-Options: DENY`
     - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
     - `X-Content-Type-Options: nosniff`
     - `Referrer-Policy: strict-origin-when-cross-origin`
     - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
     - `X-DNS-Prefetch-Control: on`
  2. **Admin routes (`/admin/:path*`)** — Permissive CSP (Payload admin requires unsafe-eval):
     - Same headers EXCEPT CSP uses: `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' *.blob.vercel-storage.com img.youtube.com avatars.githubusercontent.com data: blob:; font-src 'self' data:; connect-src 'self' *.sentry.io; frame-src 'self' www.youtube.com; object-src 'none'; base-uri 'self'; form-action 'self'`
- Headers property placed in `nextConfig` after `redirects` (line 81).
- Next.js applies last-matching-header-wins so admin-specific group (listed second) overrides general CSP for `/admin/*`.

**Tests (FAIL before, PASS after):**
- `tests/unit/infra/security-headers.spec.ts` (NEW):
  1. `next.config.js exports a config with headers() function`
  2. `headers() returns array with general and admin route groups`
  3. `general CSP does NOT contain unsafe-eval`
  4. `admin CSP contains unsafe-eval`
  5. `all required security headers are present for both groups`

**Acceptance Criteria:**
- [ ] `nextConfig` object has `headers` async function
- [ ] General routes: strict CSP (no unsafe-eval)
- [ ] Admin routes: permissive CSP (unsafe-eval, unsafe-inline)
- [ ] All 7 security headers present for both route groups
- [ ] `pnpm -s tsc --noEmit` passes

---

## Step 2: Frontend Error Boundary (Spec §2)

**Files to Touch:**
- `src/app/(frontend)/error.tsx` (NEW)

**Exact Behavior:**
- Create Client Component error boundary for `(frontend)` route group
- Mirror `global-error.tsx` pattern but WITHOUT `<html>` / `<body>` wrapper (nested boundary, not root)
- `useEffect` → `Sentry.captureException(error)` to report to Sentry
- Locale-aware: detect `navigator.language?.startsWith('he')` for Hebrew
- Content: heading ("Something went wrong!" / "משהו השתבש!"), "Try again" / "נסה שוב" button
- "Try again" calls `reset()`
- Tailwind styling: `bg-background`, `text-foreground`, centered layout, primary button

**Tests (FAIL before, PASS after):**
- `tests/unit/frontend/error-boundary.spec.tsx` (NEW):
  1. `renders error heading and try again button`
  2. `calls Sentry.captureException with the error`
  3. `calls reset when Try Again is clicked`

**Acceptance Criteria:**
- [ ] File exists at `src/app/(frontend)/error.tsx`
- [ ] Has `'use client'` directive
- [ ] Imports and uses `Sentry.captureException`
- [ ] Has locale detection for Hebrew/English
- [ ] Has reset button
- [ ] Does NOT wrap in `<html>` or `<body>` tags

---

## Step 3: Env Variable Validation + instrumentation.ts (Spec §3)

**Files to Touch:**
- `src/infra/config/env-validation.ts` (NEW)
- `instrumentation.ts` (MODIFIED — lines 4-6, inside nodejs runtime block)

**Exact Behavior:**

**env-validation.ts:**
- Export `validateEnv()` function
- Use `z.object()` schema:
  - **Required** (throw): `DATABASE_URL`, `PAYLOAD_SECRET`, `BLOB_READ_WRITE_TOKEN` — `z.string().min(1)`
  - **Optional** (warn): `SENTRY_DSN`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GITHUB_TOKEN` — `z.string().optional()`
  - **Public** (warn): `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_SENTRY_DSN` — `z.string().optional()`
- Required: `safeParse(process.env)`, if error → throw with list of missing vars
- Optional/Public: check individually with `console.warn` if empty

**instrumentation.ts:**
- Inside the nodejs runtime block (after sentry import on line 5), add:
  ```
  const { validateEnv } = await import('./src/infra/config/env-validation')
  validateEnv()
  ```
- Uses relative path `./src/infra/config/env-validation` (matching existing `./sentry.server.config` pattern in same file — `@/` alias may not resolve in instrumentation context)

**Tests (FAIL before, PASS after):**
- `tests/unit/infra/env-validation.spec.ts` (NEW):
  1. `throws when DATABASE_URL is missing`
  2. `throws when PAYLOAD_SECRET is missing`
  3. `throws when BLOB_READ_WRITE_TOKEN is missing`
  4. `does not throw when all required vars are set`
  5. `warns when optional vars are missing`

**Acceptance Criteria:**
- [ ] `validateEnv()` exported from new file
- [ ] Required vars throw on missing
- [ ] Optional vars warn but don't throw
- [ ] `instrumentation.ts` calls `validateEnv()` in nodejs runtime block
- [ ] Tests pass: `pnpm vitest run --config vitest.config.unit.mts tests/unit/infra/env-validation.spec.ts`

---

## Step 4: Enhance handleCodyApiError with Sentry (Spec §5a)

**Files to Touch:**
- `src/ui/cody/github-error-handler.ts` (MODIFIED — add import after line 5, add captureException at line 75)

**Exact Behavior:**
- Add `import * as Sentry from '@sentry/nextjs'` after the existing imports (after line 5)
- Inside `handleCodyApiError()`, add `Sentry.captureException(error, { tags: { route: routeName } })` at line 75 (after `const safeMessage` but before the if-chain)
- This single change covers ALL 14+ Cody routes that import `handleCodyApiError`

**Tests (FAIL before, PASS after):**
- `tests/unit/cody-api-routes.spec.ts` (EXISTING — add/verify):
  1. `handleCodyApiError calls Sentry.captureException` — mock Sentry, call with generic Error, verify captureException called with tags

**Acceptance Criteria:**
- [ ] `import * as Sentry from '@sentry/nextjs'` added
- [ ] `Sentry.captureException(error, { tags: { route: routeName } })` called inside handleCodyApiError
- [ ] Existing tests still pass

---

## Step 5: Add captureAndRespond to 6 Non-Cody Routes (Spec §5b)

**Files to Touch:**
- `src/app/api/conversations/by-context/route.ts` (MODIFIED — catch blocks at lines 58, 120, 150)
- `src/app/api/blob/upload-token/route.ts` (MODIFIED — outer catch at line 153)
- `src/app/api/jobs/run-immediate/route.ts` (MODIFIED — catch at line 159)
- `src/app/api/pdfjs-viewer/route.ts` (MODIFIED — catch at line 111)
- `src/app/api/copilotkit/route.ts` (MODIFIED — catch at line 161)
- `src/app/api/agent/message/persist/route.ts` (MODIFIED — catch at line 111)

**Exact Behavior:**
Replace bare `catch → console.error/logger.error → NextResponse.json(500)` with dynamic import of `captureAndRespond`:

```typescript
} catch (error) {
  const { captureAndRespond } = await import('@/server/api/capture-and-respond')
  return captureAndRespond(error, { route: '/api/<route-name> <METHOD>' })
}
```

**Route-specific notes:**
- **conversations/by-context**: Has 3 catch blocks (GET line 58, POST line 120, DELETE line 150) — update all 3
- **blob/upload-token**: Outer catch at line 153 is bare `catch {}` — add `error` param: `catch (error) {`
- **jobs/run-immediate**: Keep inner try/catch for job status update, add captureAndRespond to main catch
- **agent/message/persist**: Keep `if (error instanceof z.ZodError)` branch, add `captureAndRespond` in else branch only

**Tests (FAIL before, PASS after):**
- `tests/unit/api-sentry-coverage.spec.ts` (NEW — static analysis):
  1. `conversations/by-context contains captureAndRespond`
  2. `blob/upload-token contains captureAndRespond`
  3. `pdfjs-viewer contains captureAndRespond`
  4. `copilotkit contains captureAndRespond`

**Acceptance Criteria:**
- [ ] All 6 routes use `captureAndRespond` in catch blocks
- [ ] `blob/upload-token` catch block has `error` parameter
- [ ] `agent/message/persist` preserves ZodError check
- [ ] `pnpm -s tsc --noEmit` passes
- [ ] `pnpm lint` passes

---

## Step 6: Add Sentry to 4 High-Traffic Routes (Spec §5c)

**Files to Touch:**
- `src/app/api/agent/chat/route.ts` (MODIFIED — catch at line 78)
- `src/app/api/agent/chat/stream/route.ts` (MODIFIED — catch at line 88)
- `src/app/api/exercises/import/route.ts` (MODIFIED — catch at line 48)
- `src/app/api/exercises/validate-answer/route.ts` (MODIFIED — catch at line 29)

**Exact Behavior:**
Add `Sentry.captureException(error, { tags: { route: '<route-path>' } })` via dynamic import:

```typescript
} catch (error) {
  // existing logger.error stays
  const Sentry = await import('@sentry/nextjs')
  Sentry.captureException(error, { tags: { route: '/api/<route-name>' } })
  // existing NextResponse.json error return stays
}
```

**Important**: NOT migrating to `withApiHandler` — downstream functions accept PayloadRequest objects, requiring deep refactoring. Pragmatic Sentry capture achieves spec's primary goal.

**Tests (FAIL before, PASS after):**
- `tests/unit/api-sentry-coverage.spec.ts` (same file, add assertions):
  1. `agent/chat/route.ts contains Sentry.captureException`
  2. `agent/chat/stream/route.ts contains Sentry.captureException`
  3. `exercises/import/route.ts contains Sentry.captureException`
  4. `exercises/validate-answer/route.ts contains Sentry.captureException`

**Acceptance Criteria:**
- [ ] All 4 routes have `Sentry.captureException` in catch blocks
- [ ] Existing error response behavior preserved
- [ ] `pnpm -s tsc --noEmit` passes

---

## Step 7: Zod Validation for 4 POST Routes + Sentry (Spec §6)

**Files to Touch:**
- `src/app/api/agent/conversation/route.ts` (MODIFIED — replace lines 17-20 with Zod, add Sentry to catch)
- `src/app/api/agent/reset-chat/route.ts` (MODIFIED — replace lines 17-20 with Zod, add Sentry to catch)
- `src/app/api/cody/tasks/route.ts` (MODIFIED — add Zod to POST handler)
- `src/app/api/cody/tasks/approve-review/route.ts` (MODIFIED — replace lines 25-27 with Zod, add Sentry to catch)

**Exact Behavior:**

**agent/conversation** and **agent/reset-chat** (identical pattern):
- Add `import { z } from 'zod'` at top
- Define: `const bodySchema = z.object({ contextKey: z.string().min(1) })`
- Replace `if (!body.contextKey)` check with: `const validated = bodySchema.parse(body)`, then use `validated.contextKey`
- In catch block, add Sentry dynamic import + capture before existing error response
- Wrap Zod error: if `error instanceof z.ZodError` → return 400 with validation details, else existing 500 + Sentry

**cody/tasks POST**:
- Add Zod schema for POST body fields
- Validate after `req.json()`
- Error handling already uses `handleCodyApiError` (which now has Sentry from Step 4)

**cody/tasks/approve-review**:
- Add `import { z } from 'zod'`
- Define: `const bodySchema = z.object({ prNumber: z.number().int().positive(), actorLogin: z.string().optional() })`
- Replace `if (!prNumber)` with Zod parse
- Add Sentry to outer catch block

**Tests (FAIL before, PASS after):**
- `tests/unit/api-zod-validation.spec.ts` (NEW):
  1. `agent/conversation returns 400 for missing contextKey`
  2. `agent/reset-chat returns 400 for missing contextKey`
  3. `cody/tasks/approve-review returns 400 for missing prNumber`

**Acceptance Criteria:**
- [ ] All 4 routes use Zod for input validation
- [ ] Invalid input returns structured 400 error
- [ ] Valid input passes through to existing logic
- [ ] Sentry capture added to catch blocks
- [ ] `pnpm -s tsc --noEmit` passes

---

## Step 8: CI Coverage + Web Vitals (Spec §7, §8)

**Files to Touch:**
- `.github/workflows/ci.yml` (MODIFIED — line 66)
- `src/infra/instrumentation-client.ts` (MODIFIED — lines 21-26)

**Exact Behavior:**

**CI Coverage (ci.yml line 66):**
- Change `run: pnpm test:unit` to `run: pnpm test:unit -- --coverage`
- Add new step after unit tests:
  ```yaml
  - name: Upload coverage report
    uses: actions/upload-artifact@v4
    if: always()
    with:
      name: coverage-report
      path: coverage/
      retention-days: 7
  ```

**Web Vitals (instrumentation-client.ts):**
- Add `Sentry.browserTracingIntegration()` to `integrations` array alongside existing `replayIntegration`:
  ```typescript
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  ```
- Automatically captures LCP, FID/INP, CLS, TTFB, FCP at existing `tracesSampleRate: 0.1`.

**Tests (FAIL before, PASS after):**
- `tests/unit/infra/instrumentation-client.spec.ts` (NEW):
  1. `instrumentation-client includes browserTracingIntegration`
- CI coverage: verified by CI run artifact upload.

**Acceptance Criteria:**
- [ ] CI workflow runs tests with `--coverage`
- [ ] Coverage report uploaded as artifact
- [ ] `browserTracingIntegration()` in instrumentation-client integrations array
- [ ] `pnpm -s tsc --noEmit` passes
- [ ] `pnpm lint` passes
