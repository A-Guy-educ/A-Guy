# Codebase Context: 260316-auto-648

## Files to Modify
- `next.config.js` (lines 80-81, insert `headers` async function into `nextConfig` object) — Add security headers with split CSP
- `src/app/(frontend)/error.tsx` (NEW) — Create frontend error boundary
- `src/infra/config/env-validation.ts` (NEW) — Create Zod env validation
- `instrumentation.ts` (lines 4-6, inside nodejs runtime block) — Hook validateEnv() call
- `src/ui/cody/github-error-handler.ts` (add Sentry import after line 5, add Sentry.captureException at line 75) — Enhance handleCodyApiError
- `src/app/api/conversations/by-context/route.ts` (catch blocks at lines 58, 120, 150) — Replace with captureAndRespond
- `src/app/api/blob/upload-token/route.ts` (outer catch at line 153: bare catch{} → catch(error) + captureAndRespond) — Fix bare catch
- `src/app/api/jobs/run-immediate/route.ts` (catch at line 159) — Add captureAndRespond
- `src/app/api/pdfjs-viewer/route.ts` (catch at line 111) — Replace with captureAndRespond
- `src/app/api/copilotkit/route.ts` (catch at line 161) — Replace with captureAndRespond
- `src/app/api/agent/message/persist/route.ts` (catch at line 111: add captureAndRespond for non-Zod branch) — Add Sentry to else
- `src/app/api/agent/chat/route.ts` (catch at line 78) — Add Sentry.captureException
- `src/app/api/agent/chat/stream/route.ts` (catch at line 88) — Add Sentry.captureException
- `src/app/api/exercises/import/route.ts` (catch at line 48) — Add Sentry.captureException
- `src/app/api/exercises/validate-answer/route.ts` (catch at line 29) — Add Sentry.captureException
- `src/app/api/agent/conversation/route.ts` (lines 17-20 replace manual check with Zod, catch add Sentry) — Zod + Sentry
- `src/app/api/agent/reset-chat/route.ts` (lines 17-20 replace manual check with Zod, catch add Sentry) — Zod + Sentry
- `src/app/api/cody/tasks/route.ts` (POST handler, add Zod body validation) — Zod
- `src/app/api/cody/tasks/approve-review/route.ts` (lines 25-27 replace manual check with Zod, add Sentry to catch) — Zod + Sentry
- `.github/workflows/ci.yml` (line 66: add --coverage flag + new artifact upload step) — CI coverage
- `src/infra/instrumentation-client.ts` (lines 21-26: add browserTracingIntegration) — Web Vitals

## Files to Read (reference patterns)
- `src/app/global-error.tsx` — Error boundary pattern (Sentry, locale detection, Tailwind, root-level with html/body wrapper)
- `src/app/(cody)/cody/error.tsx` — Nested error boundary pattern (NO html/body tags)
- `src/server/api/capture-and-respond.ts` — captureAndRespond utility (import + use pattern)
- `src/app/api/study-plan/route.ts` — captureAndRespond dynamic import usage example
- `src/app/api/chapters/by-grade/route.ts` — captureAndRespond dynamic import usage example
- `tests/unit/cody-api-routes.spec.ts` — Existing test file for handleCodyApiError

## Key Signatures
- `captureAndRespond(error: unknown, context: { route: string; requestId?: string }): NextResponse` from `src/server/api/capture-and-respond.ts`
- `handleCodyApiError(error: unknown, routeName: string): NextResponse<ApiErrorResponse>` from `src/ui/cody/github-error-handler.ts`
- `Sentry.captureException(error, { tags: {}, extra: {} })` from `@sentry/nextjs`
- `Sentry.browserTracingIntegration()` from `@sentry/nextjs`
- `validateEnv(): void` from `src/infra/config/env-validation.ts` (NEW)

## Reuse Inventory
- `captureAndRespond` from `src/server/api/capture-and-respond.ts` — use for 6 non-Cody routes (Step 5)
- `handleCodyApiError` from `src/ui/cody/github-error-handler.ts` — enhance with Sentry, covers 14+ Cody routes (Step 4)
- `Sentry.*` from `@sentry/nextjs` — already available project-wide
- `z` from `zod` — already imported in many files
- `logger` from `@/infra/utils/logger/logger` — already imported in most routes
- Dynamic import pattern for captureAndRespond: `const { captureAndRespond } = await import('@/server/api/capture-and-respond')`
- Dynamic import pattern for Sentry: `const Sentry = await import('@sentry/nextjs')`

## Integration Points
- `instrumentation.ts` register() runs at Node.js startup — env validation goes here after sentry import
- `handleCodyApiError` is imported by 14+ Cody API routes — single Sentry addition covers all
- `vitest.config.unit.mts` already has coverage config (v8 provider, thresholds at 30/25/30) — NO changes needed
- `next.config.js` uses ESM (`import`), wrapped by `withPayload()` then `withSentryConfig()`
- Sentry tunnel: `tunnelRoute: '/monitoring'` means connect-src needs `'self'` not `*.sentry.io` for frontend

## Imports Verified
- `@sentry/nextjs` → exports `captureException`, `browserTracingIntegration`, `replayIntegration` ✅
- `@/server/api/capture-and-respond` → exports `captureAndRespond` ✅
- `@/ui/cody/github-error-handler` → exports `handleCodyApiError` ✅
- `@/infra/utils/logger/logger` → exports `logger` ✅
- `zod` → exports `z`, `ZodError` ✅

## Test Commands
- Unit tests: `pnpm vitest run --config vitest.config.unit.mts`
- Typecheck: `pnpm -s tsc --noEmit`
- Lint: `pnpm lint`
- Specific test: `pnpm vitest run --config vitest.config.unit.mts tests/unit/infra/env-validation.spec.ts`
