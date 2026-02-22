# Plan: 260220-auto-34 — Remove/Replace console.log Statements

## Summary

Replace ~65+ raw `console.log`/`console.warn`/`console.error` statements across the codebase with structured Pino logging (server-side) or dev-gated conditionals (client-side). The project already has a Pino logger at `src/infra/utils/logger/logger.ts` with `logger` singleton and `createRequestLogger()` helper. Most existing code already uses `import { logger } from '@/infra/utils/logger'`.

## Assumptions

1. The Pino logger at `src/infra/utils/logger` is the canonical structured logger — no changes needed to it.
2. Analytics files marked `'use client'` (GA4/Mixpanel adapters, tracker, config) run client-side only and cannot use Pino — they should gate logs behind `analyticsConfig.debugMode` (which is already `process.env.NODE_ENV === 'development'`).
3. The `system-events-subscriber.ts` runs client-side (imported from tracker which is `'use client'`), so it uses the same dev-gating pattern.
4. Test utility files (`test-db-constraint.ts`, `mongodb-container.ts`) are out of scope per spec ("out of scope: adding new logging logic for unlogged events").
5. Files in `src/infra/system-events/bus.ts` that use `console.warn`/`console.error` in the event bus core are infrastructure — we migrate these to Pino since they run server-side too. However, since `bus.ts` may be imported in both contexts, we'll use a conditional pattern.
6. Console statements inside JSX string literals (like Mixpanel scripts.tsx inline `<Script>` tags) that are rendered as raw JS strings cannot be replaced with Pino imports — they use the `analyticsConfig.debugMode` gate which is already correctly set.

---

## Step 1: Server-Side V2 Exercise Conversion Services

**Time estimate**: 15 min

**Spec requirements**: FR-001, NFR-001, Acceptance Criteria #1

**Files to touch**:
- `src/server/services/exercise-conversion/v2/text-detection-service.ts` (MODIFIED — lines 75-127)
- `src/server/services/exercise-conversion/v2/ocr-detection-service.ts` (MODIFIED — lines 59-92)
- `src/server/services/exercise-conversion/v2/vision-text-combo-service.ts` (MODIFIED — lines 53-93)
- `src/server/services/exercise-conversion/v2/vision-detection-service.ts` (MODIFIED — lines 146, 154)

**Exact behavior**:
- Add `import { logger } from '@/infra/utils/logger'` to each file (or create a child logger `const log = logger.child({ service: 'v2-text-detect' })` etc.)
- Replace all `console.log(...)` → `log.debug(...)` (verbose detection output)
- Replace all `console.warn(...)` → `log.warn(...)`
- Replace all `console.error(...)` → `log.error({ err: error }, 'message')`
- Preserve all message content and structured context (page index, line counts, etc.)
- Use Pino's object-first convention: `log.debug({ pageIndex, lineCount: lines.length }, '[V2-TextDetect] extracted text lines')`

**Tests** (1 integration test file):
- **File**: `tests/unit/server/services/exercise-conversion/v2-logging.test.ts` (NEW)
- **Test 1**: `text-detection-service does not call console.log` — Import the module, mock the logger, call the exported function with sample data, verify `console.log` was NOT called (spy on `console.log`) and that `logger.debug` WAS called.
- **Test 2**: `vision-detection-service logs errors via logger.error` — Mock a failing AI response, verify `logger.error` is called with error object.

**Acceptance criteria**:
- [ ] `grep -r 'console\.' src/server/services/exercise-conversion/v2/` returns zero matches (excluding comments)
- [ ] All existing `console.error` calls are preserved as `logger.error` with `{ err }` structured context
- [ ] No behavioral changes — same functions exported, same signatures

---

## Step 2: Server-Side Job Task Handlers

**Time estimate**: 20 min

**Spec requirements**: FR-001, NFR-001, Acceptance Criteria #2

**Files to touch**:
- `src/server/payload/jobs/pdf-to-exercises-task.ts` (MODIFIED — lines 143, 162, 330, 355, 372, 486, 593, 615, 622, 667)
- `src/server/payload/jobs/pdf-to-exercises-v2-task.ts` (MODIFIED — lines 105, 108, 132, 138, 147, 153, 164, 174, 191, 254, 277, 388, 405)

**Exact behavior**:
- Add `import { logger } from '@/infra/utils/logger'` to each file
- Create child loggers with job context: `const log = logger.child({ task: 'pdf-to-exercises-v2', jobId: job.id })`
- Replace `console.log(...)` → `log.info(...)` for progress messages (e.g., "Loading pages", "Rendered N pages")
- Replace `console.warn(...)` → `log.warn(...)` for non-critical issues (skipping invalid exercises, missing collections)
- Replace `console.error(...)` → `log.error({ err: error }, 'message')` for failures
- Preserve all job ID references and contextual information in structured fields

**Tests** (1 test file):
- **File**: `tests/unit/server/payload/jobs/v2-task-logging.test.ts` (NEW)
- **Test 1**: `pdf-to-exercises-v2-task uses structured logger for progress` — Spy on console.log, import module, verify no console.log calls exist in the source (static analysis via grep or by mocking logger and invoking a portion of the handler).
- **Test 2**: `pdf-to-exercises-v2-task logs errors with err context` — Verify `logger.error` is called with `{ err }` property when job fails.

**Acceptance criteria**:
- [ ] `grep -r 'console\.' src/server/payload/jobs/pdf-to-exercises` returns zero matches (excluding comments)
- [ ] Error stacks preserved via `{ err: error }` pattern in all `.error()` calls
- [ ] Job ID is included in structured context for all log messages

---

## Step 3: Server-Side API Routes

**Time estimate**: 20 min

**Spec requirements**: FR-001, NFR-001, Acceptance Criteria #4

**Files to touch**:
- `src/app/api/jobs/run-immediate/route.ts` (MODIFIED — lines 108, 111, 113, 151, 159, 172)
- `src/app/api/exercises/import/route.ts` (MODIFIED — lines 41, 44, 48)
- `src/app/api/exercises/convert/runner/route.ts` (MODIFIED — lines 52, 95)
- `src/app/api/exercises/convert/queue/route.ts` (MODIFIED — line 176)
- `src/app/api/exercises/convert/queue-v2/route.ts` (MODIFIED — line 114)
- `src/app/api/prompts/for-conversion/route.ts` (MODIFIED — line 133)
- `src/app/api/blob/upload-token/route.ts` (MODIFIED — lines 120, 135, 137)
- `src/app/api/chapters/by-grade/route.ts` (MODIFIED — line 95)
- `src/app/api/chat-assets/finalize/route.ts` (MODIFIED — line 167)

**Exact behavior**:
- Import `{ logger } from '@/infra/utils/logger'` in each route file
- For routes that already have request context, use `logger.child({ route: 'run-immediate' })` or similar
- Replace `console.log(...)` → `log.info(...)` for progress/informational
- Replace `console.error(...)` → `log.error({ err: error }, 'message')` for errors
- Replace `console.warn(...)` → `log.warn(...)` for warnings

**Tests** (1 test file):
- **File**: `tests/unit/api/routes/no-console-in-routes.test.ts` (NEW)
- **Test 1**: `API route files do not contain raw console statements` — Use `fs.readFileSync` to read each route file and assert no `/console\.(log|warn|error)/` matches exist (excluding comments). This is a static guardrail test.
- **Test 2**: `run-immediate route uses logger.error for failures` — Import the route module with mocked dependencies, trigger error path, verify `logger.error` was called.

**Acceptance criteria**:
- [ ] `grep -rn 'console\.' src/app/api/` returns zero matches for the listed route files
- [ ] Error details (stack traces, error messages) preserved in structured format
- [ ] No behavioral changes to API response shapes or status codes

---

## Step 4: Analytics Infrastructure — Client-Side Dev-Gating

**Time estimate**: 25 min

**Spec requirements**: FR-002, Acceptance Criteria #3

**Files to touch**:
- `src/infra/analytics/core/tracker.ts` (MODIFIED — lines 72, 96, 120, 136, 146, 165, 175, 188, 204, 217)
- `src/infra/analytics/config.ts` (MODIFIED — lines 67, 73)
- `src/infra/analytics/system-events-subscriber.ts` (MODIFIED — lines 25, 39, 46, 165, 208)
- `src/infra/analytics/adapters/ga4/adapter.ts` (MODIFIED — lines 41, 54, 57, 71, 78, 93, 96)
- `src/infra/analytics/adapters/mixpanel/adapter.ts` (MODIFIED — lines 53, 96, 103, 106, 156, 159, 176, 190, 193, 213, 222, 234, 237, 272, 275, 293)
- `src/infra/analytics/core/validator.ts` (MODIFIED — lines 36, 73)
- `src/infra/analytics/hooks/useSessionDuration.ts` (MODIFIED — line 46) — already correctly gated, no change needed
- `src/infra/analytics/hooks/usePageAbandonment.ts` (MODIFIED — line 72) — already correctly gated, no change needed
- `src/infra/analytics/utils/anonymous-id.ts` (MODIFIED — line 50)

**Exact behavior**:

For **tracker.ts**, **config.ts**, **validator.ts**: These already gate most `console.log` behind `analyticsConfig.debugMode` (which equals `NODE_ENV === 'development'`). For the ones that DON'T (e.g., `console.error` in catch blocks), wrap in `if (process.env.NODE_ENV === 'development')` or gate behind `analyticsConfig.debugMode`. The `console.error` calls in catch blocks should be retained but gated:
```
// Before: console.error('[Analytics] Track failed:', err)
// After:  // Removed console.error for client-side as per spec (NFR-001)
```
Note: For actual errors in catch blocks where we want visibility, a server-side error reporting mechanism should be used instead of `console.error` as per spec (NFR-001). Since these are `'use client'` files, `console.error` statements will be removed entirely.

For **system-events-subscriber.ts**:
- `console.log('[Analytics] 🔄 Initializing...')` → gate behind `if (analyticsConfig.debugMode)`
- `console.log('[Analytics] 📥 RECEIVED: CHAT_MESSAGE_SUBMITTED', payload)` → gate behind `if (analyticsConfig.debugMode)`
- `console.log('[Analytics] ✅ System events subscriber initialized...')` → gate behind `if (analyticsConfig.debugMode)`
- `console.warn('[Analytics] Subscriber already initialized')` → gate behind `if (analyticsConfig.debugMode)`
- `console.error(...)` in error handler → **remove entirely** as per spec (NFR-001).

For **GA4 adapter** and **Mixpanel adapter**: 
- Debug logs already gated behind `analyticsConfig.debugMode` ✅
- `console.error` in catch blocks → **remove entirely** as per spec (NFR-001). Client-side errors should be handled by a server-side reporting mechanism if critical.
- `console.warn` for "SDK not loaded" → gate behind `if (analyticsConfig.debugMode)` (some already are)
- `console.error` for critical config errors (no measurement ID, gtag not available) → **remove entirely** as per spec (NFR-001). These should be surfaced through UI or a server-side reporting mechanism.

For **anonymous-id.ts**:
- `console.warn('[Analytics] Failed to read anonymous ID cookie:', error)` → gate behind `if (process.env.NODE_ENV === 'development')`

**Tests** (1 test file):
- **File**: `tests/unit/analytics/no-unconditional-console.test.ts` (NEW)
- **Test 1**: `analytics client files have no unconditional console statements` — Static analysis test: read each analytics file, parse out all `console.(log|warn|error)` occurrences, verify each one is inside a conditional block (`if (analyticsConfig.debugMode)` or `if (process.env.NODE_ENV === 'development')`).
- **Test 2**: `tracker.ts gates all console.log behind debugMode` — Import tracker, mock `analyticsConfig.debugMode = false`, call `track()` with invalid args, verify no console output.

**Acceptance criteria**:
- [ ] Every `console.log` in analytics files is gated behind `analyticsConfig.debugMode` or `NODE_ENV === 'development'`
- [ ] Every `console.error` in analytics files is gated behind `analyticsConfig.debugMode` or `NODE_ENV === 'development'`
- [ ] `useSessionDuration.ts` and `usePageAbandonment.ts` are already correctly gated (verify, no changes needed)
- [ ] No unconditional console statements remain in analytics infrastructure

---

## Step 5: Client-Side UI Components

**Time estimate**: 10 min

**Spec requirements**: FR-003, Acceptance Criteria #5

**Files to touch**:
- `src/ui/web/CommandPalette.tsx` (MODIFIED — lines 70, 75)
- `src/infra/analytics/adapters/ga4/scripts.tsx` (MODIFIED — lines 21-25, 29, 36)
- `src/infra/analytics/adapters/mixpanel/scripts.tsx` (MODIFIED — line 136) — inline JS in Script tag, already gated behind `analyticsConfig.debugMode` ✅

**Exact behavior**:

For **CommandPalette.tsx**:
- Lines 70, 75 have `console.log('Search triggered')` and `console.log('New document triggered')` as placeholder action callbacks
- Replace with no-ops: `() => handleSelect(() => { /* TODO: implement search */ })` or remove the console.log entirely, leaving empty callback bodies
- These are clearly placeholder/stub implementations

For **GA4Scripts.tsx**:
- Line 21-25: `console.log('[GA4Scripts] Rendering:', {...})` — unconditional debug log → gate behind `if (analyticsConfig.debugMode)`
- Line 29: `console.warn('[GA4Scripts] Not loading...')` → gate behind `if (analyticsConfig.debugMode)`
- Line 36: `console.warn('[Analytics/GA4] No measurement ID...')` → gate behind `if (analyticsConfig.debugMode)`
- Any `console.error` statements in `GA4Scripts.tsx` should be **removed entirely** as per spec (NFR-001).

For **MixpanelScripts.tsx**: Already correctly gated behind `analyticsConfig.debugMode` ✅ — verify only.

**Tests** (1 test file):
- **File**: `tests/unit/ui/no-console-in-components.test.ts` (NEW)
- **Test 1**: `CommandPalette.tsx contains no console.log statements` — Static file read + regex assertion.
- **Test 2**: `GA4Scripts.tsx has no unconditional console statements` — Static file read, verify all `console.*` are inside conditionals.

**Acceptance criteria**:
- [ ] `CommandPalette.tsx` has zero `console.log` statements
- [ ] `GA4Scripts.tsx` has zero unconditional `console.*` statements
- [ ] No behavioral changes to component rendering or props

---

## Step 6: Remaining Server-Side Files (Hooks, Repos, Infra)

**Time estimate**: 20 min

**Spec requirements**: FR-001, NFR-001

**Files to touch**:
- `src/server/payload/hooks/chapters/computeAdminTitle.ts` (MODIFIED — line 48)
- `src/server/payload/hooks/revalidateRedirects.ts` (MODIFIED — line 10)
- `src/server/payload/collections/Pages/hooks/revalidatePage.ts` (MODIFIED — line 13)
- `src/server/payload/collections/Posts/hooks/revalidatePost.ts` (MODIFIED — line 13)
- `src/server/payload/collections/Exercises/index.ts` (MODIFIED — line 124)
- `src/server/services/exercise-conversion/helpers.ts` (MODIFIED — lines 155, 207)
- `src/server/services/api/api-service.ts` (MODIFIED — lines 128, 202, 241)
- `src/server/repos/queries/pages.ts` (MODIFIED — line 63)
- `src/server/repos/queries/exercises.ts` (MODIFIED — line 36)
- `src/server/payload/jobs/pdf-to-exercises-task.ts` already covered in Step 2
- `src/server/payload/services/job-service.ts` (MODIFIED — lines 27, 92)
- `src/ui/web/search/beforeSync.ts` (MODIFIED — line 47)
- `src/ui/web/header/hooks/revalidateHeader.ts` (MODIFIED — line 10)
- `src/ui/web/footer/hooks/revalidateFooter.ts` (MODIFIED — line 10)
- `src/infra/system-events/bus.ts` (MODIFIED — lines 101, 118, 128)
- `src/infra/blob/vercel-blob-adapter.ts` (MODIFIED — line 183)
- `src/infra/config/runtime/config-values.ts` (MODIFIED — line 71)
- `src/infra/llm/doc-search.ts` (MODIFIED — line 50)
- `src/infra/loading/LoadingManager.ts` (MODIFIED — line 49)
- `src/infra/pdfjs/renderer.ts` (MODIFIED — line 123)
- `src/server/payload/blocks/Form/Component.tsx` (MODIFIED — line 103)
- `src/app/(frontend)/posts/page/[pageNumber]/page.tsx` (MODIFIED — line 92)
- `src/app/(frontend)/posts/[slug]/page.tsx` (MODIFIED — line 25)
- `src/app/(frontend)/exercises/[id]/page.tsx` (MODIFIED — line 65)
- `src/app/(frontend)/[slug]/page.tsx` (MODIFIED — line 20)
- `src/app/(frontend)/signup/actions/signup_createUser-action.ts` (MODIFIED — lines 108, 137)
- `src/app/(frontend)/login/login_authenticate-action.ts` (MODIFIED — line 88)

**Exact behavior**:

For **server-side files** (hooks, services, repos, server actions):
- Import `{ logger } from '@/infra/utils/logger'` 
- Replace `console.error(...)` → `logger.error({ err: error }, 'message')`
- Replace `console.warn(...)` → `logger.warn('message')`
- In hooks that receive `req` parameter (revalidate hooks), prefer `req.payload.logger` if available, fall back to imported logger

For **Next.js page files** (`posts/page.tsx`, `[slug]/page.tsx`, etc.):
- These are server components; use `import { logger } from '@/infra/utils/logger'`
- Replace `console.warn(...)` → `logger.warn('message')`
- Replace `console.error(...)` → `logger.error({ err: error }, 'message')`

For **client-side files** (`useNotebookChat.ts`, `GreetingFlow/index.tsx`, `ErrorBoundary/index.tsx`, admin components):
- `useNotebookChat.ts` already uses the logger ✅ — but has remaining `console.error` calls at lines 426, 490, 519. Given `useNotebookChat.ts` seems to be client-side due to its name, these `console.error` calls should be **removed entirely** as per spec (NFR-001). If this file is determined to be server-side, then `logger.error({ err: error }, 'message')` would be appropriate.
- `GreetingFlow/index.tsx` line 39 → gate behind `process.env.NODE_ENV === 'development'`
- `ErrorBoundary/index.tsx` line 29 → **remove entirely** as per spec (NFR-001). Client-side error boundaries should use a server-side error reporting mechanism, not `console.error`.
- Admin components (`ConvertForm`, `LessonConversionPanel`, `DraftExercisesList`, etc.) → **remove all `console.error` statements entirely** as per spec (NFR-001). If these components run client-side, any `console.log`/`console.warn` should be gated behind `process.env.NODE_ENV === 'development'`.

For **infra files**:
- `bus.ts` — can be used both client and server side. Gate `console.warn`/`console.error` behind `process.env.NODE_ENV === 'development'` or use a try/catch with logger if available.
- `vercel-blob-adapter.ts` — server-side → use `logger.error`
- `config-values.ts` — server-side → use `logger.warn`
- `doc-search.ts` — server-side → use `logger.error`
- `LoadingManager.ts` — client-side → any `console.log`/`console.warn` should be gated behind `process.env.NODE_ENV === 'development'`. Any `console.error` should be **removed entirely** as per spec (NFR-001).
- `pdfjs/renderer.ts` — client-side → any `console.log`/`console.warn` should be gated behind `process.env.NODE_ENV === 'development'`. Any `console.error` should be **removed entirely** as per spec (NFR-001).

**Tests** (1 comprehensive guardrail test):
- **File**: `tests/unit/guardrails/no-raw-console.test.ts` (NEW)
- **Test 1**: `no unconditional console.log/warn/error in server-side source files` — Scan all `src/server/**/*.ts`, `src/app/api/**/*.ts`, and `src/app/(frontend)/**/*.ts` files using `fs` + regex. Exclude test files, node_modules, and comments. Assert zero unconditional `console.*` statements.
- **Test 2**: `no unconditional console.log in client-side component files` — Scan `src/ui/**/*.tsx`, `src/infra/**/*.ts(x)` (non-analytics). Verify all `console.*` calls are inside `NODE_ENV` or `debugMode` conditionals, or are in test-only files.

**Acceptance criteria**:
- [ ] All server-side hooks, services, repos use `logger.*` instead of `console.*`
- [ ] All client-side components gate `console.*` behind dev checks
- [ ] Error visibility preserved — no error information lost
- [ ] No functional/behavioral changes in any file

---

## Step 7: Final Guardrail & CI Gate

**Time estimate**: 10 min

**Spec requirements**: All acceptance criteria

**Files to touch**:
- `tests/int/guardrails/no-raw-console.int.spec.ts` (NEW)

**Exact behavior**:
- Create a comprehensive integration-level guardrail test that scans the ENTIRE `src/` directory
- Use `glob` + `fs.readFileSync` to read all `.ts` and `.tsx` files
- Exclude: `node_modules`, `*.test.*`, `*.spec.*`, test utility files (`src/infra/utils/test/`), and inline `<Script>` tag contents
- For server-side files (`src/server/`, `src/app/api/`): Assert zero `console.(log|warn|error)` calls
- For client-side files: Assert all `console.*` are wrapped in conditionals (`process.env.NODE_ENV === 'development'` or `analyticsConfig.debugMode`)
- This test prevents regressions — any new `console.log` in production code will fail CI

**Tests**:
- **Test 1**: `server-side files contain no raw console statements` — Full directory scan
- **Test 2**: `client-side files contain no unconditional console statements` — Full directory scan with conditional checking

**Acceptance criteria**:
- [ ] The guardrail test passes
- [ ] Running `grep -rn "console\.\(log\|warn\|error\)" src/ --include="*.ts" --include="*.tsx"` returns only properly-gated instances in client-side code, inline `<Script>` strings, comments, or test files
- [ ] `pnpm tsc --noEmit` passes (no type errors from logger imports)
- [ ] `pnpm lint` passes

---

## Test Execution

```bash
# Run all new tests
pnpm vitest run tests/unit/server/services/exercise-conversion/v2-logging.test.ts
pnpm vitest run tests/unit/server/payload/jobs/v2-task-logging.test.ts
pnpm vitest run tests/unit/api/routes/no-console-in-routes.test.ts
pnpm vitest run tests/unit/analytics/no-unconditional-console.test.ts
pnpm vitest run tests/unit/ui/no-console-in-components.test.ts
pnpm vitest run tests/unit/guardrails/no-raw-console.test.ts
pnpm vitest run tests/int/guardrails/no-raw-console.int.spec.ts

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint
```

## Dependencies Between Steps

Steps 1-6 can be done in any order. Step 7 (guardrail) should be done last since it validates all the others.

## Risk Mitigation

- **Risk**: Importing `logger` in client-side files causes SSR/bundling issues.
  **Mitigation**: Only use logger in server-side files. Client-side files use `console.*` gated behind `process.env.NODE_ENV === 'development'`.

- **Risk**: `req.payload.logger` is undefined in some hook contexts.
  **Mitigation**: Use the standalone `logger` import as fallback. The spec guardrail says "MUST NOT cause application crashes if req.payload.logger is unavailable".

- **Risk**: Removing console.error hides critical errors.
  **Mitigation**: All `console.error` are upgraded to `logger.error` (server) or dev-gated (client), never silently removed. NFR-001 explicitly requires error visibility.
