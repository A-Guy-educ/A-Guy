# System Stability, Maintenance & AI Agent Optimization Plan

**Generated**: 2026-03-02
**Scope**: Full-system audit across 4 domains: Error Handling & Resilience, Testing Infrastructure, CI/CD & Configuration, AI Agent Optimization
**Task Type**: improvement
**Priority Sort**: P0 (critical/breaking) → P1 (high/stability) → P2 (medium/quality) → P3 (low/polish)

---

## Priority Legend

| Level | Meaning | Timeline |
|-------|---------|----------|
| **P0** | Broken, silent failures, or security gaps actively causing harm | Fix this week |
| **P1** | Significant stability/quality risk or major productivity drag | Fix within 2 weeks |
| **P2** | Quality improvement, coverage gaps, maintenance burden | Fix within a month |
| **P3** | Polish, documentation cleanup, minor optimization | Backlog |

---

## P0 — CRITICAL (Fix This Week)

### Task 1: Fix Silently Excluded Integration Tests

**Problem**: 3 integration test files use `.int.test.ts` extension instead of `.int.spec.ts`, so they are **never executed** by `pnpm test:int`. The vitest config include pattern `tests/int/**/*.int.spec.ts` does not match them.

**Files to Touch**:
- `tests/int/system-params.int.test.ts` → RENAME to `tests/int/system-params.int.spec.ts`
- `tests/int/runtime-config.int.test.ts` → RENAME to `tests/int/runtime-config.int.spec.ts`
- `tests/int/config-manager.int.test.ts` → RENAME to `tests/int/config-manager.int.spec.ts`

**Verification**:
- `pnpm test:int -- --reporter=verbose 2>&1 | grep -E "system-params|runtime-config|config-manager"` should show tests running
- Before fix: 0 matches. After fix: 3 test suites visible.

**Acceptance Criteria**:
- [ ] All 3 files renamed to `.int.spec.ts`
- [ ] `pnpm test:int` discovers and runs these tests
- [ ] All tests pass

---

### Task 2: Fix Broken CI Workflows (5 failures)

**Problem**: Multiple CI workflows reference non-existent files, scripts, or action versions, causing silent or loud failures.

**Files to Touch**:
1. `.github/workflows/ci.yml` lines 267, 275 (MODIFIED) — Change `actions/upload-artifact@v6` → `@v4` (v6 does not exist)
2. `.github/workflows/ai-docs-refresh.yml` line 48 (MODIFIED) — Replace `pnpm run ai:docs:validate` with a valid script or remove the step
3. `.github/workflows/doc-link-fixer.yml` line 49 (MODIFIED) — Remove or fix `pnpm tsx scripts/github-issue-upsert.ts` reference (file does not exist)
4. `.github/workflows/supervisor.yml` line 40 (MODIFIED) — Fix `.sh` extension to `.ts` (the file `parse-safety-supervisor.ts` exists, not `.sh`)
5. `package.json` line 88 (MODIFIED) — Fix `"release": "semantic run generate:types-release"` → `"release": "semantic-release"`

**Verification**:
- Trigger each workflow in a dry-run or inspect with `act` for syntax validity
- `pnpm release --dry-run` should not fail with "command not found: semantic"

**Acceptance Criteria**:
- [ ] `ci.yml` uses `upload-artifact@v4` consistently
- [ ] `ai-docs-refresh.yml` step references a valid script
- [ ] `doc-link-fixer.yml` does not reference non-existent file
- [ ] `supervisor.yml` calls correct `.ts` file
- [ ] `release` script in package.json is syntactically valid

---

### Task 3: Fix ESLint Boundary Rules (Currently No-Ops)

**Problem**: All `no-restricted-imports` rules in `eslint.config.mjs` use descriptive labels (like `'ui-no-server-services'`) instead of actual module path patterns. ESLint interprets these as literal module names, so the rules **never trigger**. Layer boundary enforcement is completely broken.

**Files to Touch**:
- `eslint.config.mjs` lines 68-198 (MODIFIED) — Rewrite `no-restricted-imports` rules to use `paths` array format with actual module patterns

**Example Fix**:
```javascript
// BEFORE (broken):
'no-restricted-imports': ['error', { name: 'ui-no-server-services', message: '...' }]

// AFTER (correct):
'no-restricted-imports': ['error', {
  paths: [
    { name: '@/server/services', message: 'UI layer cannot import server services' },
    { name: '@/server/payload', message: 'UI layer cannot import Payload internals' },
  ],
  patterns: ['@/server/**']
}]
```

**Verification**:
- Create a test file in `src/ui/` that imports from `@/server/services/` → should trigger lint error
- `pnpm lint` should report violations for any existing cross-layer imports

**Acceptance Criteria**:
- [ ] Each architectural layer has correct import restrictions
- [ ] `pnpm lint` enforces boundaries (test with a deliberate violation)
- [ ] Existing code passes lint (fix any discovered violations)

---

### Task 4: Fix AGENTS.md Project Structure (Wrong Paths)

**Problem**: AGENTS.md documents `src/collections/`, `src/globals/`, `src/hooks/`, `src/access/`, `src/components/` — **none of these exist**. Every AI agent reading this creates files in wrong directories. This is loaded as primary context for ALL AI tools.

**Files to Touch**:
- `AGENTS.md` lines 20-35 (MODIFIED) — Update project structure to match reality
- `AGENTS.md` lines 646, 904, 948-958, 1192 (MODIFIED) — Remove stale `src/components/` references
- `AGENTS.md` lines 865-901 (MODIFIED) — Remove SCSS styling section (contradicts Tailwind-only policy)
- `.ai-docs/quick-reference/CHEAT-SHEET.md` "Key Imports" section (MODIFIED) — Fix `@/access` → `@/server/payload/access`
- `.lintstagedrc.json` lines 7-8 (MODIFIED) — Fix `src/collections/` → `src/server/payload/collections/`, fix `src/components/` → `src/ui/`

**Correct Structure**:
```
src/
├── app/                         # Next.js App Router
│   ├── (frontend)/              # Frontend routes
│   ├── (payload)/              # Payload admin routes
│   └── api/                     # API routes
├── client/                      # Client-side hooks, state, utils
├── infra/                       # Infrastructure (analytics, auth, blob, LLM, config)
├── server/                      # Server-side code
│   ├── payload/
│   │   ├── collections/         # Collection configs
│   │   ├── globals/             # Global configs
│   │   ├── hooks/               # Hook functions
│   │   ├── access/              # Access control functions
│   │   ├── endpoints/           # Custom endpoints
│   │   └── jobs/                # Background jobs
│   └── services/                # Business logic services
├── ui/                          # React components
│   ├── admin/                   # Payload admin UI components
│   └── web/                     # Frontend/consumer UI components
├── i18n/                        # Internationalization
├── types/                       # Type declarations
├── lib/                         # Shared utilities
└── payload.config.ts            # Main config
```

**Verification**:
- Grep AGENTS.md for `src/collections/` → 0 results
- Grep AGENTS.md for `src/components/` → 0 results (except the deprecation removal note)
- Grep AGENTS.md for `.scss` → 0 results

**Acceptance Criteria**:
- [ ] Project structure in AGENTS.md matches actual filesystem
- [ ] All `src/components/` references removed
- [ ] SCSS styling section removed or replaced with Tailwind guidance
- [ ] CHEAT-SHEET.md import paths are correct
- [ ] lint-staged glob patterns match actual file locations
- [ ] Run `pnpm run ai:generate-docs` to regenerate doc-chunks.json

---

### Task 5: Sentry Error Capture — Almost No Caught Errors Reach Sentry

**Problem**: Only 1 explicit `Sentry.captureException()` call exists in the entire codebase (in the example route). All API routes catch errors in try/catch blocks but only `console.error` them. Since Sentry's `onRequestError` hook only catches *unhandled* errors, Sentry is essentially blind to all production errors.

**Files to Touch**:
- `src/server/errors.ts` (MODIFIED) — Add centralized `captureAndRespond()` utility
- 15+ API route files in `src/app/api/` (MODIFIED) — Replace ad-hoc catch blocks with centralized utility

**Behavior**:
```typescript
// New utility in src/server/errors.ts
export function captureAndRespond(error: unknown, context: { route: string; requestId?: string }) {
  const logger = getLogger(context.route)
  logger.error({ err: error, requestId: context.requestId }, 'API error')
  Sentry.captureException(error, { tags: { route: context.route }, extra: { requestId: context.requestId } })
  
  const statusCode = error instanceof APIError ? error.status : 500
  const message = error instanceof APIError ? error.message : 'Internal server error'
  return NextResponse.json({ error: message }, { status: statusCode })
}
```

**Tests**:
- Unit test: `captureAndRespond()` calls `Sentry.captureException` and returns correct status
- Integration test: Trigger a 500 error on an API route, verify Sentry mock receives the exception

**Acceptance Criteria**:
- [ ] Centralized error utility created with Sentry integration
- [ ] At least 10 highest-traffic API routes migrated to use the utility
- [ ] All migrated routes use structured pino logger (not console.error)
- [ ] Unit test verifies Sentry capture behavior

---

## P1 — HIGH PRIORITY (Fix Within 2 Weeks)

### Task 6: Health Check Does Not Verify Database Connectivity

**Problem**: `/api/health` returns `ok: true` without checking if MongoDB is reachable. It also uses synchronous `execSync('git rev-parse HEAD')` which blocks the event loop.

**Files to Touch**:
- `src/app/api/health/route.ts` (MODIFIED) — Add DB ping, remove execSync

**Behavior**:
```typescript
// Add dependency checks
const checks = {
  database: false,
  timestamp: new Date().toISOString(),
}

try {
  await payload.find({ collection: 'users', limit: 1, depth: 0 })
  checks.database = true
} catch (e) {
  checks.database = false
}

const ok = checks.database
return Response.json({ ok, checks, version, gitSha: process.env.GIT_SHA || 'unknown' })
```

**Tests**:
- Integration test: Health endpoint returns `ok: true` and `checks.database: true` when DB is available
- Integration test: Health endpoint returns correct version format

**Acceptance Criteria**:
- [ ] Health endpoint verifies database connectivity
- [ ] No `execSync` calls remain
- [ ] Response includes `checks` object with dependency status
- [ ] Returns `ok: false` when DB is unreachable

---

### Task 7: Add Missing try/catch to Unprotected API Routes

**Problem**: Several API routes have no try/catch, meaning unhandled errors will crash with unstructured 500 responses:
- `/api/teacher-profiles` GET handler
- `/api/user-settings` GET handler
- `/api/cron/upload-session-cleanup`
- `/api/cron/chat-asset-expiry`
- `/api/cron/guest-sessions-cleanup`
- `/api/chapters/by-grade` (also missing auth check)

**Files to Touch**:
- `src/app/api/teacher-profiles/route.ts` (MODIFIED)
- `src/app/api/user-settings/route.ts` (MODIFIED)
- `src/app/api/cron/upload-session-cleanup/route.ts` (MODIFIED)
- `src/app/api/cron/chat-asset-expiry/route.ts` (MODIFIED)
- `src/app/api/cron/guest-sessions-cleanup/route.ts` (MODIFIED)
- `src/app/api/chapters/by-grade/route.ts` (MODIFIED) — Add auth check + try/catch

**Tests**:
- Integration test per route: Verify proper error response (not a crash) when an error is forced

**Acceptance Criteria**:
- [ ] All listed routes wrapped in try/catch
- [ ] All catch blocks use centralized error utility (Task 5)
- [ ] `/api/chapters/by-grade` requires authentication
- [ ] Integration tests cover error cases

---

### Task 8: Optimize AI Agent Hooks (20-30s Delay Per Edit)

**Problem**: Every `.ts/.tsx` file edit triggers 4 sequential hooks (prettier + tsc + console.log check + compact suggester). The `tsc --noEmit` alone takes 5-15 seconds. Combined latency: ~20-30 seconds per edit.

**Files to Touch**:
- `.claude/hooks/hooks.json` (MODIFIED)

**Changes**:
1. Make TSC hook `async: true` so it runs in background without blocking
2. Remove per-edit console.log check (duplicate of the Stop hook at line 134)
3. Optionally: batch prettier + lint into a single Node script

**Verification**:
- Time an edit operation before and after: should drop from ~20-30s to ~3-5s

**Acceptance Criteria**:
- [ ] TSC hook runs asynchronously (non-blocking)
- [ ] Per-edit console.log check removed (Stop hook remains)
- [ ] Edit latency reduced to <5 seconds

---

### Task 9: Remove Irrelevant/Generic Skills from `.agents/skills/`

**Problem**: `.agents/skills/` contains 25+ skills, many of which are generic framework templates using wrong stacks (FastAPI, Supabase, Jest, npm). The `tdd-workflow/SKILL.md` references `npm test` and `jest.fn()` — none of which apply to this pnpm/vitest project. Agents following these skills use wrong commands.

**Files to Touch**:
- `.agents/skills/` — Remove or archive irrelevant skills

**Skills to Remove/Archive**:
- `configure-ecc/` — Framework installer, not useful at runtime
- `find-skills/` — Skills.sh marketplace search, not project-useful
- `eval-harness/` — Never integrated eval framework
- `continuous-learning/` — Superseded by `continuous-learning-v2/`
- `strategic-compact/` — Generic memory management, duplicates built-in behavior

**Skills to Fix**:
- `tdd-workflow/SKILL.md` — Replace npm/jest references with pnpm/vitest
- `new-collection/SKILL.md` — Fix `src/collections/` path to `src/server/payload/collections/`
- `coding-standards/SKILL.md` — Remove duplication with `.claude/rules/`

**Acceptance Criteria**:
- [ ] No skills reference `npm test`, `jest`, `src/collections/`, or other wrong-stack patterns
- [ ] Removed skills are archived (not deleted) in `.agents/skills/_archive/`
- [ ] Remaining skills use correct project paths and commands

---

### Task 10: Fix Integration Test Environment (jsdom → node)

**Problem**: `vitest.config.mts` sets `environment: 'jsdom'` for integration tests. Integration tests hit APIs and databases — they don't need DOM emulation. Many tests already override with `// @vitest-environment node`. The default should be `node`.

**Files to Touch**:
- `vitest.config.mts` (MODIFIED) — Change `environment: 'jsdom'` → `environment: 'node'`
- Remove `// @vitest-environment node` comments from tests that added the override

**Verification**:
- `pnpm test:int` passes with `environment: 'node'`
- No tests break from the change

**Acceptance Criteria**:
- [ ] Default integration test environment is `node`
- [ ] All integration tests pass
- [ ] Redundant `@vitest-environment node` directives removed

---

### Task 11: Standardize Logging (Replace console.* with Pino)

**Problem**: 29 `console.error/warn/log` calls in API routes, 57 in server code. Only agent/chat routes use structured pino logging. Production observability is degraded.

**Files to Touch**:
- `src/app/api/exercises/convert/queue/route.ts` (MODIFIED)
- `src/app/api/exercises/convert/queue-v2/route.ts` (MODIFIED)
- `src/app/api/exercises/convert/runner/route.ts` (MODIFIED)
- `src/app/api/study-plan/route.ts` (MODIFIED)
- `src/app/api/blob/upload-token/route.ts` (MODIFIED)
- `src/app/api/chat-assets/finalize/route.ts` (MODIFIED)
- `src/server/services/exercise-conversion/v2/text-detection-service.ts` (MODIFIED)
- `src/server/services/exercise-conversion/v2/ocr-detection-service.ts` (MODIFIED)
- `src/server/payload/jobs/pdf-to-exercises-task.ts` (MODIFIED)
- `src/server/payload/jobs/pdf-to-exercises-v2-task.ts` (MODIFIED)
- Additional files with `console.error` in server-side code

**Verification**:
- `grep -r "console\.\(error\|warn\|log\)" src/app/api/ src/server/ --include="*.ts" | wc -l` should decrease by 50+

**Acceptance Criteria**:
- [ ] All API route catch blocks use pino logger
- [ ] All server service files use pino logger
- [ ] `console.*` usage in `src/app/api/` and `src/server/` reduced to near-zero (client-side exempted)

---

### Task 12: Add Missing Vercel Cron for Guest Session Cleanup

**Problem**: `/api/cron/guest-sessions-cleanup` exists as an endpoint but has no trigger — not in `vercel.json` and not in any GitHub workflow. Guest sessions accumulate indefinitely.

**Files to Touch**:
- `vercel.json` (MODIFIED) — Add cron entry for guest-sessions-cleanup

**Verification**:
- `vercel.json` contains entry for `/api/cron/guest-sessions-cleanup`
- Cron schedule is appropriate (daily or weekly)

**Acceptance Criteria**:
- [ ] `vercel.json` includes guest-sessions-cleanup cron
- [ ] Cron schedule is documented

---

## P2 — MEDIUM PRIORITY (Fix Within a Month)

### Task 13: Expand Test Coverage for Untested Collections (13/25 untested)

**Problem**: 13 of 25 collections have zero dedicated tests, including security-sensitive ones like `ConfigSecrets`, `Tenants`, `UserSettings`, `UserProgress`.

**Collections to Test (by priority)**:
1. **UserProgress** — Business-critical student learning data
2. **UserSettings** — User preferences, data integrity
3. **Tenants** — Multi-tenancy isolation (security)
4. **ConfigSecrets** — Secret management (security)
5. **ChatAssets** — File upload lifecycle
6. **UploadSessions** — Upload lifecycle
7. **TeacherProfiles** — Profile data
8. **PricingPlans** — Business logic
9. **Categories** — Content organization
10. **Posts**, **Pages** — CMS content

**Files to Create**:
- `tests/int/user-progress.int.spec.ts` (NEW)
- `tests/int/user-settings.int.spec.ts` (NEW)
- `tests/int/tenants.int.spec.ts` (NEW)
- `tests/int/config-secrets.int.spec.ts` (NEW)
- `tests/int/chat-assets.int.spec.ts` (NEW)

**Each test should cover**:
- CRUD operations
- Access control enforcement (admin vs user vs unauthenticated)
- Required field validation
- Relationship integrity

**Acceptance Criteria**:
- [ ] At least 5 most critical collections have integration tests
- [ ] Access control tested with `overrideAccess: false`
- [ ] All tests pass in CI

---

### Task 14: Add Test Coverage for Untested API Routes (14/40 untested)

**Problem**: 14 API routes have no test coverage, including security-sensitive endpoints.

**Routes to Test (by priority)**:
1. `/api/agent/message/persist` — Data loss risk
2. `/api/blob/upload-token` — Security (token generation)
3. `/api/chat-assets/finalize` — Blob lifecycle
4. `/api/cron/guest-sessions-cleanup` — Data retention
5. `/api/cron/chat-asset-expiry` — Blob cleanup
6. `/api/user-settings` — User data CRUD
7. `/api/study-plan` — Study plan logic
8. `/api/chapters/by-grade` — Content queries
9. `/api/teacher-profiles` — Profile queries

**Files to Create**:
- `tests/int/api/message-persist.int.spec.ts` (NEW)
- `tests/int/api/blob-upload-token.int.spec.ts` (NEW)
- `tests/int/api/chat-assets-finalize.int.spec.ts` (NEW)
- `tests/int/api/cron-cleanup.int.spec.ts` (NEW)
- `tests/int/api/user-settings.int.spec.ts` (NEW)

**Acceptance Criteria**:
- [ ] At least 5 most critical routes have integration tests
- [ ] Auth-required routes tested with and without authentication
- [ ] Error cases tested (invalid input, missing data)

---

### Task 15: Add External Integration Test Suite (AI Models, Blob Storage, Media)

**Problem**: External service integrations are mostly mocked. Real integration tests would catch model regressions, API changes, and pipeline failures. The user explicitly notes tests CAN include external tool integrations.

**Files to Create**:
- `vitest.config.external.mts` (NEW) — Config for external tests with 60s timeout
- `tests/int/external/ai-model-responses.int.spec.ts` (NEW) — Real AI model output validation
- `tests/int/external/blob-lifecycle.int.spec.ts` (NEW) — Full Vercel Blob upload/delete lifecycle
- `tests/int/external/pdf-conversion-pipeline.int.spec.ts` (NEW) — End-to-end PDF → exercises
- `tests/int/external/image-processing.int.spec.ts` (NEW) — Sharp-based image optimization
- `package.json` (MODIFIED) — Add `"test:external"` script

**External Test Patterns**:
```typescript
// Use describe.runIf for conditional execution
describe.runIf(process.env.RUN_EXTERNAL_TESTS === 'true')('AI Model Responses', () => {
  it('should extract exercise from image via Gemini', async () => {
    const result = await extractFromImage({ imageBuffer: testImage, mimeType: 'image/jpeg' })
    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({
      question: expect.any(String),
      options: expect.any(Array),
    })
  }, 30000)
})
```

**AI Model Tests** (run with `GEMINI_API_KEY` and/or `OPENAI_API_KEY`):
1. Image-to-exercise extraction — Verify JSON matches Zod schema with real Gemini
2. Exercise chat — Verify pedagogically relevant response from real model
3. Memory extraction — Verify extracted memories have correct type/importance from conversation
4. Embedding dimensionality — Verify real OpenAI embeddings return correct dimensions

**Blob Storage Tests** (run with `BLOB_READ_WRITE_TOKEN`):
1. Media upload via Payload → verify blob URL stored
2. Chat asset lifecycle: upload → finalize → verify → expire → verify deleted
3. Upload session cleanup flow

**Media/Image Tests** (always run — CPU-intensive but deterministic):
1. Image optimization via sharp — verify dimensions, format, quality
2. Image cropping — verify output matches expected regions
3. PDF rendering — verify page count and image output from test PDF

**CI Integration**:
- Add GitHub workflow: `external-integration.yml` — runs weekly or on-demand
- Environment secrets: `GEMINI_API_KEY`, `OPENAI_API_KEY`, `BLOB_READ_WRITE_TOKEN`

**Acceptance Criteria**:
- [ ] `pnpm test:external` runs external tests when env vars present
- [ ] Tests skip gracefully when env vars missing
- [ ] At least 3 AI model response tests validate Zod schema compliance
- [ ] Blob lifecycle test covers upload → verify → delete
- [ ] Image processing tests verify deterministic output
- [ ] Weekly CI workflow runs external tests

---

### Task 16: Expand Unit Test Coverage Configuration

**Problem**: Coverage tracking only includes `src/lib/**/*.ts` (6 files). Coverage reports are meaningless — they don't cover collections, services, access control, or infrastructure.

**Files to Touch**:
- `vitest.config.unit.mts` (MODIFIED) — Expand coverage includes

**New Coverage Config**:
```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'html', 'lcov'],
  include: [
    'src/server/payload/access/**/*.ts',
    'src/server/payload/collections/**/*.ts',
    'src/server/payload/hooks/**/*.ts',
    'src/server/payload/endpoints/**/*.ts',
    'src/server/services/**/*.ts',
    'src/infra/llm/**/*.ts',
    'src/infra/blob/**/*.ts',
    'src/infra/config/**/*.ts',
    'src/lib/**/*.ts',
  ],
  exclude: ['**/*.spec.ts', '**/*.test.ts', '**/index.ts'],
  thresholds: {
    statements: 30,  // Start low, increase over time
    branches: 25,
    functions: 30,
  },
}
```

**Also**:
- Delete orphaned `vitest.unit.config.mts` (not referenced by any script)
- Move any tests in `src/**/*.test.ts` to `tests/unit/`

**Acceptance Criteria**:
- [ ] Coverage includes critical server-side code paths
- [ ] Coverage thresholds prevent regression
- [ ] Orphaned vitest config deleted
- [ ] `pnpm test:unit -- --coverage` reports meaningful percentages

---

### Task 17: Add Circuit Breaker for LLM Calls

**Problem**: No circuit breaker pattern exists. If Gemini API goes down, the system continues attempting calls on every request, consuming resources and returning 500 errors. There's no graceful degradation for AI services.

**Files to Touch**:
- `src/infra/llm/providers/shared/circuit-breaker.ts` (NEW) — Circuit breaker implementation
- `src/infra/llm/genkit/adapters/unified-adapter.ts` (MODIFIED) — Wrap calls with circuit breaker
- `src/app/api/agent/chat/route.ts` (MODIFIED) — Return friendly message when circuit is open

**Behavior**:
- After N consecutive failures (e.g., 5), circuit opens for T seconds (e.g., 60)
- During open state, calls fail fast with "AI temporarily unavailable"
- After timeout, circuit enters half-open state, allows one test request
- On success, circuit closes; on failure, re-opens

**Tests**:
- Unit test: Circuit opens after N failures, closes after successful probe
- Integration test: Chat endpoint returns friendly error when circuit is open

**Acceptance Criteria**:
- [ ] Circuit breaker implemented with configurable thresholds
- [ ] LLM adapter wraps all calls with circuit breaker
- [ ] Chat endpoints return user-friendly message when AI unavailable
- [ ] Unit and integration tests pass

---

### Task 18: Add Missing Test Factories

**Problem**: Only 5 factories exist for 25 collections. Tests duplicate inline data creation with 20-90 line setup blocks.

**Files to Create**:
- `tests/factories/media.factory.ts` (NEW) — Reusable test JPEG buffer + Payload create
- `tests/factories/prompt.factory.ts` (NEW) — Prompt variants (system, user, conversion)
- `tests/factories/tenant.factory.ts` (NEW) — Tenant with name/domain
- `tests/factories/upload-session.factory.ts` (NEW) — Upload session lifecycle
- `tests/factories/chat-asset.factory.ts` (NEW) — Chat asset with blob reference

**Each factory pattern**:
```typescript
export function buildMediaData(overrides?: Partial<MediaData>): MediaData { ... }
export async function createMedia(payload: Payload, overrides?: Partial<MediaData>): Promise<Media> { ... }
```

**Acceptance Criteria**:
- [ ] At least 3 new factories created
- [ ] Existing tests refactored to use factories (reduce setup blocks by 50%)
- [ ] Factory builder pattern consistent with existing `context.factory.ts`

---

### Task 19: Fix Multi-Tool Config Drift

**Problem**: `.roo/`, `.opencode/`, `.cursor/` all contain stale paths (`src/collections/`, `src/components/`). Agent definitions diverge across tools — different capabilities, different naming.

**Files to Touch**:
- `.roo/rules/index.md` line 40 (MODIFIED) — Fix path references
- `.opencode/agents/payload-expert.md` line 12 (MODIFIED) — Fix path references
- `.cursor/commands/new-collection.md` line 8 (MODIFIED) — Fix path references

**Approach**: Either:
1. Create a single source of truth (e.g., `.ai-docs/paths.json`) and have each tool reference it
2. Or manually update all tools to match current structure

**Acceptance Criteria**:
- [ ] `grep -r "src/collections/" .roo/ .opencode/ .cursor/` returns 0 results
- [ ] `grep -r "src/components/" .roo/ .opencode/ .cursor/` returns 0 results
- [ ] All tool configs reference correct paths

---

### Task 20: Standardize MongoDB Setup in Integration Tests

**Problem**: Integration tests use 3 different patterns for MongoDB setup (direct container, shared singleton, implicit env var). This causes slower execution, flaky behavior, and duplicated 20-line `beforeAll` blocks.

**Files to Touch**:
- `tests/setup/shared-payload.ts` (MODIFIED if needed) — Ensure it's the canonical setup
- 10+ integration test files (MODIFIED) — Migrate to `getSharedPayload()`

**Acceptance Criteria**:
- [ ] All integration tests use `getSharedPayload()` from shared setup
- [ ] No tests call `startMongoContainer()` directly
- [ ] `pnpm test:int` execution time reduced by consolidating containers

---

### Task 21: Implement Rate Limiting for Authenticated + LLM Endpoints

**Problem**: Rate limiting only applies to guest sessions (in-memory). No rate limiting for authenticated users or LLM endpoints that call external APIs with cost implications. The in-memory implementation is bypassable in serverless.

**Files to Touch**:
- `src/server/services/rate-limit.ts` (MODIFIED) — Add per-user rate limiting, add LLM-specific limits
- `src/app/api/agent/chat/route.ts` (MODIFIED) — Apply rate limit
- `src/app/api/agent/chat/stream/route.ts` (MODIFIED) — Apply rate limit

**Acceptance Criteria**:
- [ ] Authenticated users have per-minute rate limits on chat endpoints
- [ ] LLM endpoints have separate, stricter rate limits
- [ ] Rate limit service has clear warning comment about serverless limitations
- [ ] `Retry-After` header included in rate limit responses

---

## P3 — LOW PRIORITY (Backlog)

### Task 22: Clean Up Redundant/Stale Configuration

**Items**:
1. `next.config.js` — Remove duplicate `eslint` key (lines 56, 80)
2. `package.json` — Remove duplicate `format:all` script (identical to `format`)
3. `package.json` — Fix `format:check` to include `*.md` (matches `format`)
4. `docker-compose.yml` — Remove deprecated `version: '3'`, pin `mongo:7`
5. `Dockerfile` — Add comment that `output: 'standalone'` is required, or remove unused Dockerfile
6. `.env.example` — Add 9+ missing env vars documented in CI/CD analysis
7. `payload.config.ts` — Add `PAYLOAD_SECRET` validation guard (like `DATABASE_URL`)
8. `vitest.unit.config.mts` — Delete orphaned file

**Acceptance Criteria**:
- [ ] No duplicate configuration keys
- [ ] No orphaned config files
- [ ] `.env.example` documents all required env vars

---

### Task 23: Reduce CI Resource Usage

**Items**:
1. `exercise-conversion-runner.yml` — Change from every 5 minutes to every 15 or 30 minutes
2. Spread nightly crons: 6 daily workflows clustered in 01:15-03:00 UTC — spread to 4-hour window
3. Standardize GitHub Action versions: all workflows should use same versions (v4 or v6, pick one)
4. `aider.yaml` — Use `secrets.GH_PAT` consistently (not `secrets.PAT_TOKEN`)
5. `media-cleanup.yml` — Add `timeout-minutes: 10`

**Acceptance Criteria**:
- [ ] Consistent action versions across all workflows
- [ ] Nightly crons spread across a wider time window
- [ ] Exercise runner interval reduced

---

### Task 24: Regenerate and Improve AI Documentation Indexes

**Items**:
1. Run `pnpm run ai:generate-docs` and `pnpm run ai:generate-patterns` after Task 4
2. Fill empty `aiSummary` fields in `pattern-index.json` file metadata
3. Add file type and domain classification to pattern-index entries
4. Fix BOOTSTRAP.md: replace `pnpm ts-node scripts/validate-schemas.ts` with correct command
5. Update stale reports (repo-hygiene, doc-link, deps-security) — 5+ weeks old

**Acceptance Criteria**:
- [ ] doc-chunks.json reflects correct project structure
- [ ] pattern-index.json has descriptions for all patterns
- [ ] Reports regenerated with current data
- [ ] BOOTSTRAP.md commands are all valid

---

### Task 25: Enable E2E Test Data Seeding

**Problem**: 4+ E2E tests are skipped with "Requires test data seeding" comments. No seed script exists.

**Files to Create**:
- `tests/e2e/fixtures/seed.ts` (NEW) — Creates courses, chapters, lessons, exercises for E2E
- `playwright.config.ts` (MODIFIED) — Add global setup that runs seed

**Acceptance Criteria**:
- [ ] Seed script creates minimal test data hierarchy
- [ ] At least 2 previously-skipped E2E tests are un-skipped and pass
- [ ] Seed data cleanup runs in global teardown

---

### Task 26: Add Streaming Timeout and Retry Protection

**Problem**: LLM streaming chat completion has no retry wrapper and no timeout. A hung stream could block a serverless function until execution time limit.

**Files to Touch**:
- `src/infra/llm/genkit/adapters/unified-adapter.ts` lines 152-208 (MODIFIED) — Add timeout for stream initialization, add retry for stream setup

**Acceptance Criteria**:
- [ ] Streaming has configurable timeout (default 30s)
- [ ] Stream initialization has retry wrapper (like non-streaming calls)
- [ ] Unit test verifies timeout triggers correctly

---

### Task 27: Clean Up Deprecated Code

**Problem**: 20 `@deprecated` markers across the codebase. Some have been deprecated long enough that replacements are well-established.

**Files to Touch**:
- Search for `@deprecated` and evaluate each for removal
- Focus on files where the replacement is already in use

**Acceptance Criteria**:
- [ ] At least 10 deprecated markers resolved (code removed or un-deprecated)
- [ ] No deprecated code referenced from non-deprecated code

---

## Summary Dashboard

| Priority | Tasks | Key Theme |
|----------|-------|-----------|
| **P0** | 5 tasks | Broken CI, silent test exclusions, wrong docs, blind Sentry |
| **P1** | 7 tasks | Health checks, error handling, agent perf, test env, logging |
| **P2** | 9 tasks | Test coverage, external integrations, circuit breaker, factories |
| **P3** | 6 tasks | Config cleanup, CI optimization, E2E seeding, deprecations |
| **Total** | **27 tasks** | |

### Quick Wins (< 1 hour each):
- Task 1: Rename 3 test files
- Task 12: Add 1 line to vercel.json
- Task 10: Change 1 line in vitest.config.mts
- Task 22.8: Delete orphaned vitest.unit.config.mts

### Highest Impact:
- Task 4: Fix AGENTS.md (affects every AI agent session)
- Task 5: Sentry integration (production visibility)
- Task 3: ESLint boundaries (architectural integrity)
- Task 8: Hook optimization (developer/agent productivity)
- Task 15: External integration tests (catch real integration failures)
