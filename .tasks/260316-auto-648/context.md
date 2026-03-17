# Codebase Context: 260316-auto-648

## Files to Modify
- `next.config.js` (lines 80-81, insert `headers()` into `nextConfig` before `reactStrictMode`) — Add security headers with split CSP
- `src/app/(frontend)/error.tsx` (NEW) — Create frontend error boundary
- `src/infra/config/env-validation.ts` (NEW) — Create Zod env validation
- `instrumentation.ts` (line 4-6, inside nodejs runtime block) — Hook validateEnv() call
- `src/ui/cody/github-error-handler.ts` (line 1 add import, line 75 add Sentry call) — Add Sentry to handleCodyApiError
- `src/app/api/conversations/by-context/route.ts` (catch blocks at lines 58, 120, 150) — Replace with captureAndRespond
- `src/app/api/blob/upload-token/route.ts` (catch at line 143) — Add error param + captureAndRespond
- `src/app/api/jobs/run-immediate/route.ts` (catch at line 159) — Add captureAndRespond after job status update
- `src/app/api/pdfjs-viewer/route.ts` (catch at line 111) — Replace with captureAndRespond
- `src/app/api/copilotkit/route.ts` (catch at line 161) — Replace with captureAndRespond
- `src/app/api/agent/message/persist/route.ts` (catch at line 116) — Add captureAndRespond for non-Zod errors
- `src/app/api/agent/chat/route.ts` (catch at line 78) — Add Sentry.captureException
- `src/app/api/agent/chat/stream/route.ts` (catch at line 88) — Add Sentry.captureException
- `src/app/api/exercises/import/route.ts` (catch at line 48) — Add Sentry.captureException
- `src/app/api/exercises/validate-answer/route.ts` (catch at line 29) — Add Sentry.captureException
- `src/app/api/agent/conversation/route.ts` (full file — add Zod schema + Sentry) — Zod validation
- `src/app/api/agent/reset-chat/route.ts` (full file — add Zod schema + Sentry) — Zod validation
- `src/app/api/cody/tasks/route.ts` (POST handler lines 357-455) — Add Zod schema
- `src/app/api/cody/tasks/approve-review/route.ts` (lines 21-27 + catch at 109) — Add Zod schema + Sentry
- `.github/workflows/ci.yml` (line 66) — Change to test:unit:coverage + add artifact upload
- `src/infra/instrumentation-client.ts` (line 21-26) — Add browserTracingIntegration

## Files to Read (reference patterns)
- `src/app/global-error.tsx` — Error boundary pattern (locale detection, Sentry, Tailwind, no html wrapper in nested)
- `src/app/(cody)/cody/error.tsx` — Alternative error boundary (nested, no html/body tags)
- `src/server/api/capture-and-respond.ts` — captureAndRespond utility (import + use pattern)
- `src/server/api/with-api-handler.ts` — withApiHandler pattern (Zod bodySchema + auth + Sentry)
- `src/app/api/exercises/convert/single/route.ts` — withApiHandler usage example
- `src/app/api/study-plan/route.ts` — captureAndRespond usage example

## Key Signatures
- `captureAndRespond(error: unknown, context: { route: string; requestId?: string }): NextResponse` from `src/server/api/capture-and-respond.ts`
- `handleCodyApiError(error: unknown, routeName: string): NextResponse<ApiErrorResponse>` from `src/ui/cody/github-error-handler.ts`
- `withApiHandler<TBody, TQuery>(options: HandlerOptions<TBody, TQuery>, handler: (ctx: ApiContext<TBody, TQuery>) => Promise<NextResponse>)` from `src/server/api/with-api-handler.ts`
- `requireCodyAuth(req: NextRequest)` from `@/ui/cody/auth`
- `verifyActorLogin(req: NextRequest, actorLogin: string)` from `@/ui/cody/auth`
- `getUserOctokit(req: NextRequest)` from `@/ui/cody/auth`
- `Sentry.captureException(error, { tags: {}, extra: {} })` from `@sentry/nextjs`
- `Sentry.browserTracingIntegration()` from `@sentry/nextjs`
- `Sentry.replayIntegration(options)` from `@sentry/nextjs`

## Reuse Inventory
- `captureAndRespond` from `src/server/api/capture-and-respond.ts` — use for 6 non-Cody routes (Step 5)
- `handleCodyApiError` from `src/ui/cody/github-error-handler.ts` — enhance with Sentry, covers 20+ Cody routes (Step 4)
- `withApiHandler` from `src/server/api/with-api-handler.ts` — reference pattern for Zod + auth + Sentry
- `Sentry.*` from `@sentry/nextjs` — already available, used in error boundary + route catch blocks
- `z` from `zod` — already imported in many files
- `logger` from `@/infra/utils/logger/logger` — already imported in most routes
- `test:unit:coverage` script from `package.json` — existing script, use in CI instead of adding flags

## Integration Points
- `instrumentation.ts` register() runs at Node.js startup — env validation goes here after sentry import
- `handleCodyApiError` is imported by 14+ Cody API routes — single change covers all
- `vitest.config.unit.mts` already has coverage config (v8 provider, thresholds at 30/25/30) — no changes needed
- `package.json` already has `test:unit:coverage` script — use this in CI
- E2E tests already merged via PR #784 — skip cherry-pick step
- `next.config.js` uses ESM (`import`), wrapped by `withPayload` then `withSentryConfig`

## Imports Verified
- `@sentry/nextjs` → exports `captureException`, `browserTracingIntegration`, `replayIntegration`, `captureRouterTransitionStart` ✅
- `@/server/api/capture-and-respond` → exports `captureAndRespond` ✅
- `@/ui/cody/github-error-handler` → exports `handleCodyApiError` ✅
- `@/server/api/with-api-handler` → exports `withApiHandler`, `ApiContext`, `AuthLevel`, `HandlerOptions` ✅
- `@/ui/cody/auth` → exports `requireCodyAuth`, `verifyActorLogin`, `getUserOctokit` ✅
- `@/infra/utils/logger/logger` → exports `logger` ✅
- `zod` → exports `z`, `ZodError` ✅

## Test Commands
- Unit tests: `pnpm vitest run --config vitest.config.unit.mts`
- Typecheck: `pnpm -s tsc --noEmit`
- Lint: `pnpm lint`
- Coverage: `pnpm test:unit:coverage`
