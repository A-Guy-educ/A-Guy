# Codebase Context: inspector-phase-c

## Files to Modify
- `scripts/inspector/index.ts` (lines 12-20, 64-72) — add imports and registration for 2 new plugins
- `scripts/inspector/plugins/project/security-scanner/rules.ts` (NEW) — security rule definitions
- `scripts/inspector/plugins/project/security-scanner/scanner.ts` (NEW) — core scanning engine
- `scripts/inspector/plugins/project/security-scanner/index.ts` (NEW) — InspectorPlugin wrapper
- `scripts/inspector/plugins/project/api-surface/cataloger.ts` (NEW) — route discovery + cataloging
- `scripts/inspector/plugins/project/api-surface/formatter.ts` (NEW) — markdown digest formatting
- `scripts/inspector/plugins/project/api-surface/index.ts` (NEW) — InspectorPlugin wrapper
- `tests/unit/scripts/inspector/security-scanner.test.ts` (NEW) — ~20 tests
- `tests/unit/scripts/inspector/api-surface.test.ts` (NEW) — ~18 tests

## Files to Read (reference patterns)
- `scripts/inspector/plugins/cody/failure-miner/index.ts` — plugin wrapper pattern (ActionRequest creation, execute closures, dedup)
- `scripts/inspector/plugins/cody/failure-miner/collector.ts` — filesystem scanning pattern (readdir, readFile, parse)
- `scripts/inspector/plugins/cody/failure-miner/analyzer.ts` — analysis module pattern (types, processing, sorting)
- `scripts/inspector/plugins/cody/failure-miner/reporter.ts` — formatting + sanitization pattern
- `scripts/inspector/plugins/cody/success-tracker/index.ts` — digest comment + Slack action pattern
- `scripts/inspector/plugins/cody/success-tracker/formatter.ts` — markdown report formatting
- `tests/unit/scripts/inspector/failure-miner.test.ts` — test pattern (makeCtx, vi.mock('fs'), action execute testing)
- `tests/unit/scripts/inspector/success-tracker.test.ts` — test pattern (makeRun, makeCtx, digest testing)

## Key Signatures
- `InspectorPlugin { name: string; description: string; domain: string; schedule?: PluginSchedule; run(ctx: InspectorContext): Promise<ActionRequest[]> }` from `scripts/inspector/core/types.ts`
- `ActionRequest { plugin: string; type: string; target?: string; urgency: Urgency; title: string; detail: string; dedupKey?: string; dedupWindowMinutes?: number; execute: (ctx: InspectorContext) => Promise<ActionResult> }` from `scripts/inspector/core/types.ts`
- `ActionResult { success: boolean; message?: string }` from `scripts/inspector/core/types.ts`
- `InspectorContext { repo: string; dryRun: boolean; state: StateStore; github: GitHubClient; log: Logger; runTimestamp: string; cycleNumber: number; slack?: SlackClient; digestIssue?: number }` from `scripts/inspector/core/types.ts`
- `GitHubClient.postComment(issueNumber: number, body: string): void` from `scripts/inspector/core/types.ts`
- `GitHubClient.createIssue(title: string, body: string, labels: string[]): number | null` from `scripts/inspector/core/types.ts`
- `GitHubClient.searchIssues(query: string): IssueInfo[]` from `scripts/inspector/core/types.ts`
- `Urgency = 'critical' | 'warning' | 'info' | 'silent'` from `scripts/inspector/core/types.ts`
- `createPluginRegistry(): PluginRegistry` from `scripts/inspector/plugins/registry.ts`

## Reuse Inventory
- `InspectorPlugin` interface from `scripts/inspector/core/types.ts` — implement for both new plugins
- `ActionRequest` type from `scripts/inspector/core/types.ts` — return from `run()` method
- `sanitizeSearchTerm()` pattern from `scripts/inspector/plugins/cody/failure-miner/reporter.ts` — replicate for search query sanitization in security-scanner
- `makeCtx()` test helper pattern from `tests/unit/scripts/inspector/failure-miner.test.ts` — replicate for new tests
- `vi.mock('fs')` testing pattern from `tests/unit/scripts/inspector/failure-miner.test.ts` — use for filesystem mocking
- `AUTH_PATTERNS` constants — defined in security-scanner/rules.ts, reused by api-surface/cataloger.ts

## Integration Points
- Must register in `scripts/inspector/index.ts` — import + `registry.register()` call
- Both plugins read filesystem via `fs` module (Node.js built-in)
- Both plugins scan `src/app/api/**/route.ts` — security-scanner for auth gaps, api-surface for full catalog
- Security scanner also scans `src/server/payload/collections/**/*.ts` and `src/**/*.{ts,tsx}`
- Both use `ctx.github.postComment()` for digest and `ctx.github.createIssue()` for critical findings
- Digest issue number from `ctx.digestIssue` (env var `INSPECTOR_DIGEST_ISSUE=817`)

## Imports Verified
- `scripts/inspector/core/types` → exports InspectorPlugin, ActionRequest, InspectorContext, GitHubClient, Urgency, ActionResult ✅
- `scripts/inspector/plugins/registry` → exports createPluginRegistry ✅
- `fs` → Node.js built-in, used by all existing plugins ✅
- `path` → Node.js built-in, used by all existing plugins ✅
- `vitest` → `describe, it, expect, vi, beforeEach` — used in all test files ✅

## API Route Data (Pre-collected, for test fixtures)

### Routes without auth (for security-scanner test fixtures):
- `cody/tasks/route.ts` — GET, POST — no auth ("open access for testing")
- `cody/tasks/[taskId]/route.ts` — GET — no auth
- `cody/tasks/[taskId]/actions/route.ts` — POST — no auth (performs GitHub mutations!)
- `cody/collaborators/route.ts` — GET — no auth
- `copilotkit/route.ts` — GET, POST — no auth
- `cody/boards/route.ts` — GET — no auth (intentional public)
- `chapters/by-grade/route.ts` — GET — no auth (public content)
- `pdfjs-viewer/route.ts` — GET — no auth (viewer proxy)

### Routes without error handling (for api-surface test fixtures):
- `teacher-profiles/route.ts` — GET — no try/catch
- `cody/auth/route.ts` — GET — no try/catch
- `oauth/google/callback/route.ts` — GET — no try/catch
- `oauth/google/route.ts` — GET — no try/catch

### Auth pattern distribution:
- `payload.auth()`: 18 routes
- `requireAuth()`: 11 routes
- `requireDashboardAuth()`: 3 routes
- `withApiHandler()`: 5 routes
- `requireAdminOrTestSecret()`: 3 routes
- CRON_SECRET: 5 routes
- manual admin check: 1 route
