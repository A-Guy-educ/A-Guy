# Phase C — Expert Scan Plugins (E1–E9) Implementation Plan

## Research Findings

### File Paths Verified
- ✅ `scripts/inspector/core/types.ts` — `InspectorPlugin`, `ActionRequest`, `InspectorContext`, `GitHubClient` interfaces
- ✅ `scripts/inspector/core/inspector.ts` — main run loop, scheduling, dedup
- ✅ `scripts/inspector/index.ts` — CLI entry point (9 plugins registered)
- ✅ `scripts/inspector/plugins/registry.ts` — `createPluginRegistry()`
- ✅ `scripts/inspector/plugins/cody/` — 8 existing plugins (health-check, audit, failure-analysis, deferred-stages, zombie-reaper, success-tracker, failure-miner, knowledge-gardener)
- ✅ `scripts/inspector/plugins/docs-sync/` — 1 existing plugin
- 🆕 `scripts/inspector/plugins/project/` — new directory for expert scan plugins
- ✅ `scripts/inspector/clients/github.ts` — `createGitHubClient()` with `createIssue`, `searchIssues`
- ✅ `src/app/api/` — 54 route.ts files cataloged
- ✅ `src/server/payload/access/` — 10 access control functions
- ✅ `src/server/payload/collections/` — 27 collection configs
- ✅ `tests/unit/scripts/inspector/` — 7 existing test files (github-client, inspector, health-check, zombie-reaper, success-tracker, failure-miner, knowledge-gardener)

### Patterns Observed
- All plugins export a named const implementing `InspectorPlugin` interface
- Multi-file plugins split into: `index.ts` (plugin wrapper + ActionRequest creation), domain modules (data collection, analysis, formatting)
- All use `dedupWindowMinutes: 23 * 60` (1380 min = 23h) for daily plugins
- All use `schedule: { every: 6 }` (nominal — CI ephemeral state means effectively every run)
- `execute()` closures capture report data from `run()` but use `execCtx` for GitHub/Slack operations
- `createIssue` returns `number | null`; `searchIssues` returns `IssueInfo[]` for dedup
- Tests use `vi.mock('fs')` for filesystem scanning, `makeCtx()` helper for mock `InspectorContext`
- Test command: `pnpm test:unit` (config: `vitest.config.unit.mts`)
- TypeScript check: `pnpm tsc --noEmit`

### Integration Points
- Must register new plugins in `scripts/inspector/index.ts` via `registry.register()`
- Plugins read filesystem directly (using `fs` and `path`), NOT via `InspectorContext`
- For API route scanning: plugins will use `fs.readFileSync` + glob patterns
- For collection scanning: plugins read collection configs from `src/server/payload/collections/`
- GitHub actions: `ctx.github.postComment()` for digest, `ctx.github.createIssue()` for critical findings

### Known Data (from exploration)

#### Routes WITHOUT Auth (12 of 54):
1. `health/route.ts` — intentional (health check)
2. `cody/tasks/route.ts` — "open access for testing"
3. `cody/tasks/[taskId]/route.ts` — "open access for testing"
4. `cody/tasks/[taskId]/actions/route.ts` — "open access for testing" ⚠️ PERFORMS GITHUB MUTATIONS
5. `cody/boards/route.ts` — intentional (public endpoint)
6. `cody/collaborators/route.ts` — "open access for testing"
7. `cody/chat/route.ts` POST handler — partial (GET has auth, POST does not)
8. `copilotkit/route.ts` — no auth
9. `chapters/by-grade/route.ts` — no auth (public content)
10. `pdfjs-viewer/route.ts` — no auth (viewer proxy)
11. `oauth/google/route.ts` — initiates OAuth (expected)
12. `oauth/google/callback/route.ts` — completes OAuth (expected)
13. `example/route.ts` — example/demo route

#### Routes WITHOUT try/catch (5 of 54):
1. `teacher-profiles/route.ts`
2. `user-settings/route.ts` (partial)
3. `cody/auth/route.ts`
4. `oauth/google/callback/route.ts`
5. `oauth/google/route.ts`

#### Auth Patterns Used:
- `payload.auth()` (18 routes), `requireAuth()` (11), `requireDashboardAuth()` (3), `withApiHandler()` (5), `requireAdminOrTestSecret()` (3), CRON_SECRET (5), manual admin check (1)

## Reuse Inventory

### Existing Utilities to Reuse
- `InspectorPlugin`, `ActionRequest`, `InspectorContext`, `GitHubClient` from `scripts/inspector/core/types.ts`
- `sanitizeSearchTerm()` pattern from `scripts/inspector/plugins/cody/failure-miner/reporter.ts` — reuse for search query sanitization
- `makeCtx()` test helper pattern from all existing test files
- `vi.mock('fs')` pattern from `failure-miner.test.ts` for filesystem mocking

### New Utilities (Justification)
- `scanFiles()` — generic file-content scanner with glob + regex rules (no existing equivalent; failure-miner's `collectFailures` is task-specific)
- `catalogRoutes()` — API route discovery + method/auth/validation extraction (novel capability)
- Security rules definitions — domain-specific, no existing equivalent

---

## Implementation Plan

### Step 1: E1 — Security Scanner: `rules.ts`

**Files to Touch:**
- `scripts/inspector/plugins/project/security-scanner/rules.ts` (NEW)

**Behavior:**
Defines all security scanning rule types and constants:
- `Severity` type: `'critical' | 'high' | 'medium' | 'low'`
- `SecurityFinding` interface: `{ rule, severity, file, line?, message, detail }`
- `AUTH_PATTERNS: RegExp[]` — 8 patterns that indicate auth presence in API routes
- `PUBLIC_ROUTE_ALLOWLIST: string[]` — routes intentionally public (health, oauth, example)
- `OVERRIDE_ACCESS_ALLOWED_DIRS: string[]` — directories where `overrideAccess: true` is expected
- `SecretPattern` interface + `SECRET_PATTERNS: SecretPattern[]` — 4 hardcoded secret regexes
- `SECRET_SCAN_EXCLUDES: string[]` — files/dirs to skip during secret scanning
- `WRITE_OPERATIONS` const — `['create', 'update', 'delete']`
- `ANYONE_ACCESS_PATTERN` — regex to detect `anyone` in collection access

**Tests (in Step 8):**
- Rule constants are well-formed (AUTH_PATTERNS all compile, SECRET_PATTERNS all compile)
- PUBLIC_ROUTE_ALLOWLIST contains expected entries

**Acceptance Criteria:**
- [ ] All types exported and usable from scanner.ts
- [ ] AUTH_PATTERNS match all 8 known auth patterns from route catalog
- [ ] PUBLIC_ROUTE_ALLOWLIST covers health, oauth/google/*, example

---

### Step 2: E1 — Security Scanner: `scanner.ts`

**Files to Touch:**
- `scripts/inspector/plugins/project/security-scanner/scanner.ts` (NEW)

**Behavior:**
Core scanning engine with 4 scan functions:

1. **`scanRoutesForMissingAuth(rootDir: string): SecurityFinding[]`**
   - Globs `src/app/api/**/route.ts` relative to rootDir
   - For each route file: reads content, checks if ANY `AUTH_PATTERNS` match
   - If none match AND file is not in `PUBLIC_ROUTE_ALLOWLIST`: create finding
   - Severity: `'critical'` if route has POST/PUT/PATCH/DELETE, `'high'` if GET-only
   - Returns array of findings

2. **`scanRoutesForOverrideAccess(rootDir: string): SecurityFinding[]`**
   - Globs `src/app/api/**/route.ts` relative to rootDir
   - For each file: checks for `overrideAccess:\s*true` or `overrideAccess\s*:\s*true`
   - Only flags files NOT in `OVERRIDE_ACCESS_ALLOWED_DIRS`
   - Severity: `'high'`

3. **`scanCollectionsForPermissiveAccess(rootDir: string): SecurityFinding[]`**
   - Globs `src/server/payload/collections/**/*.ts` relative to rootDir
   - For each file: checks if `anyone` is imported AND used in `create:`, `update:`, or `delete:` context
   - Simple heuristic: file contains both `import.*anyone` and a write operation assignment with `anyone`
   - Severity: `'medium'`

4. **`scanForHardcodedSecrets(rootDir: string): SecurityFinding[]`**
   - Globs `src/**/*.ts` and `src/**/*.tsx` relative to rootDir
   - Excludes files matching `SECRET_SCAN_EXCLUDES`
   - For each file: checks each line against `SECRET_PATTERNS`
   - Severity: `'critical'`

5. **`runAllScans(rootDir: string): SecurityFinding[]`**
   - Runs all 4 scans, returns combined findings sorted by severity

**Tests (in Step 8):**
- `scanRoutesForMissingAuth` flags a route file without auth patterns
- `scanRoutesForMissingAuth` does NOT flag a file containing `payload.auth(`
- `scanRoutesForMissingAuth` does NOT flag files in PUBLIC_ROUTE_ALLOWLIST
- `scanRoutesForMissingAuth` assigns `critical` severity to POST routes without auth
- `scanRoutesForOverrideAccess` flags `overrideAccess: true` in API route
- `scanRoutesForOverrideAccess` does NOT flag allowed directories
- `scanCollectionsForPermissiveAccess` flags `anyone` on write operations
- `scanForHardcodedSecrets` flags AWS key patterns
- `scanForHardcodedSecrets` skips test files
- `runAllScans` combines all scan results

**Acceptance Criteria:**
- [ ] All 4 scan functions work with mocked filesystem
- [ ] Severity assignments match rule definitions
- [ ] Allowlists/excludes correctly filter false positives

---

### Step 3: E1 — Security Scanner: `index.ts` (Plugin Wrapper)

**Files to Touch:**
- `scripts/inspector/plugins/project/security-scanner/index.ts` (NEW)

**Behavior:**
Implements `InspectorPlugin`:
```
name: 'security-scanner'
description: 'Scan for security vulnerabilities in API routes, collections, and source code'
domain: 'project'
schedule: { every: 6 }
```

`run(ctx)` logic:
1. Call `runAllScans(process.cwd())` to get all findings
2. If no findings → return empty array
3. Group findings by severity
4. Create digest comment action (posts summary to digest issue #817):
   - Title: `🔒 Security Scan Report`
   - Markdown table: severity | file | rule | message
   - `dedupKey: 'security-scanner:digest-daily'`
   - `dedupWindowMinutes: 1380`
5. For each `critical` finding → create `create-issue` action:
   - Title: `[Security] <finding.message> in <finding.file>`
   - Labels: `['type:security']`
   - `dedupKey: 'security-scanner:issue:<finding.file>:<finding.rule>'`
   - `dedupWindowMinutes: 1380`
   - `execute()`: search for existing open issue first (dedup via `searchIssues`), create if none

**Tests (in Step 8):**
- Plugin has correct name, description, domain
- `run()` returns empty array when no findings
- `run()` returns digest comment action when findings exist
- `run()` returns create-issue actions for critical findings
- `execute()` dedup: skips issue creation when matching issue exists
- All actions have 23h dedup window

**Acceptance Criteria:**
- [ ] Plugin implements `InspectorPlugin` interface correctly
- [ ] Digest comment includes all findings in markdown table
- [ ] Critical findings create separate GitHub issues with `type:security` label
- [ ] Dedup prevents duplicate issue creation

---

### Step 4: E5 — API Surface Auditor: `cataloger.ts`

**Files to Touch:**
- `scripts/inspector/plugins/project/api-surface/cataloger.ts` (NEW)

**Behavior:**
Discovers and catalogs all API route files:

**Types:**
```typescript
interface RouteInfo {
  path: string           // e.g. 'cody/tasks/[taskId]/route.ts'
  apiPath: string        // e.g. '/api/cody/tasks/[taskId]'
  methods: string[]      // e.g. ['GET', 'POST']
  authPattern: string    // e.g. 'requireAuth' | 'payload.auth' | 'withApiHandler' | 'CRON_SECRET' | 'none'
  hasZodValidation: boolean
  hasErrorHandling: boolean
}

interface ApiCatalog {
  routes: RouteInfo[]
  totalRoutes: number
  authenticatedRoutes: number
  unauthenticatedRoutes: number
  withValidation: number
  withoutValidation: number
  withErrorHandling: number
  withoutErrorHandling: number
  flags: CatalogFlag[]
}

interface CatalogFlag {
  route: string
  issue: string
  severity: 'high' | 'medium' | 'low'
}
```

**Functions:**

1. **`discoverRoutes(rootDir: string): RouteInfo[]`**
   - Globs `src/app/api/**/route.ts`
   - For each file: reads content, extracts methods (look for `export async function GET/POST/PUT/PATCH/DELETE` or `export const GET/POST/...`)
   - Detects auth pattern by checking AUTH_PATTERNS (reuse from security-scanner rules)
   - Detects Zod: looks for `z.object`, `z.string`, `.parse(`, `.safeParse(`, `Schema`
   - Detects error handling: looks for `try\s*{` or `withApiHandler` or `withCronMiddleware`

2. **`buildCatalog(routes: RouteInfo[]): ApiCatalog`**
   - Computes summary stats
   - Creates flags for:
     - POST/PUT/PATCH without Zod validation → `severity: 'medium'`
     - Any route without error handling → `severity: 'low'`
     - Mutation route (POST/PUT/PATCH/DELETE) without auth → `severity: 'high'` (unless allowlisted)

**Tests (in Step 9):**
- `discoverRoutes` finds route files and extracts methods correctly
- `discoverRoutes` detects auth patterns correctly
- `discoverRoutes` detects Zod validation
- `discoverRoutes` detects error handling (try/catch, withApiHandler)
- `buildCatalog` computes correct stats
- `buildCatalog` flags POST route without validation
- `buildCatalog` flags route without error handling

**Acceptance Criteria:**
- [ ] All 54 routes discoverable (verified against known catalog)
- [ ] Auth detection matches known patterns
- [ ] Flags correctly identify issues

---

### Step 5: E5 — API Surface Auditor: `formatter.ts`

**Files to Touch:**
- `scripts/inspector/plugins/project/api-surface/formatter.ts` (NEW)

**Behavior:**
Formats API catalog into markdown for the digest comment:

1. **`formatApiSurfaceDigest(catalog: ApiCatalog, cycleNumber: number): string`**
   - Header: `## 🌐 API Surface Audit — Cycle #N`
   - Summary stats table: total routes, auth/unauth counts, validation counts
   - Full route table: path | methods | auth | validation | errors
   - Flags section: bulleted list of flagged issues
   - Footer with timestamp

2. **`formatApiSurfaceSlack(catalog: ApiCatalog): string`**
   - Compact Slack-friendly format
   - Summary line + flag count

**Tests (in Step 9):**
- `formatApiSurfaceDigest` includes summary stats
- `formatApiSurfaceDigest` includes route table with all routes
- `formatApiSurfaceDigest` includes flags section when flags exist
- `formatApiSurfaceSlack` returns compact format

**Acceptance Criteria:**
- [ ] Markdown renders correctly (valid table syntax)
- [ ] All routes appear in the output
- [ ] Flags are highlighted

---

### Step 6: E5 — API Surface Auditor: `index.ts` (Plugin Wrapper)

**Files to Touch:**
- `scripts/inspector/plugins/project/api-surface/index.ts` (NEW)

**Behavior:**
Implements `InspectorPlugin`:
```
name: 'api-surface-auditor'
description: 'Catalog and audit all API routes for auth, validation, and error handling'
domain: 'project'
schedule: { every: 6 }
```

`run(ctx)` logic:
1. Call `discoverRoutes(process.cwd())` to get all routes
2. Call `buildCatalog(routes)` to get catalog + flags
3. If no routes → return empty array
4. Create digest comment action:
   - `type: 'digest'`
   - Posts full API surface report to digest issue
   - `dedupKey: 'api-surface:digest-daily'`
   - `dedupWindowMinutes: 1380`
5. If any high-severity flags exist → create warning action:
   - `type: 'digest'` (added as separate comment with just the critical flags)
   - `urgency: 'warning'`

**Tests (in Step 9):**
- Plugin has correct name, description, domain
- `run()` returns empty array when no routes found
- `run()` returns digest action with catalog
- `run()` includes warning action when high-severity flags exist
- All actions have 23h dedup window
- `execute()` posts comment to digest issue

**Acceptance Criteria:**
- [ ] Plugin implements `InspectorPlugin` interface correctly
- [ ] Full catalog posted to digest issue
- [ ] High-severity flags create additional warning actions

---

### Step 7: Register E1 + E5 in `scripts/inspector/index.ts`

**Files to Touch:**
- `scripts/inspector/index.ts` (MODIFIED — lines 12-20 for imports, lines 73-74 for registration)

**Behavior:**
Add two new imports at the top:
```typescript
import { securityScannerPlugin } from './plugins/project/security-scanner/index'
import { apiSurfaceAuditorPlugin } from './plugins/project/api-surface/index'
```

Add two new registration calls after line 72:
```typescript
registry.register(securityScannerPlugin)
registry.register(apiSurfaceAuditorPlugin)
```

**Tests:**
- Verified by successful TypeScript compilation
- Verified by existing inspector.test.ts (plugin count check may need update if it exists)

**Acceptance Criteria:**
- [ ] Both plugins imported and registered
- [ ] `pnpm tsc --noEmit` passes
- [ ] Inspector can start without errors

---

### Step 8: Write Tests — `security-scanner.test.ts`

**Files to Touch:**
- `tests/unit/scripts/inspector/security-scanner.test.ts` (NEW)

**Test Structure:**

```
describe('security-scanner rules')
  it('AUTH_PATTERNS compile and match expected strings')
  it('SECRET_PATTERNS compile and match expected strings')
  it('PUBLIC_ROUTE_ALLOWLIST contains health and oauth routes')

describe('scanRoutesForMissingAuth')
  it('flags route file without any auth pattern')
  it('does NOT flag file containing payload.auth()')
  it('does NOT flag file containing requireAuth()')
  it('does NOT flag file containing withApiHandler()')
  it('does NOT flag file in PUBLIC_ROUTE_ALLOWLIST')
  it('assigns critical severity to POST routes without auth')
  it('assigns high severity to GET-only routes without auth')

describe('scanRoutesForOverrideAccess')
  it('flags overrideAccess: true in API route file')
  it('does NOT flag overrideAccess in allowed directories')

describe('scanCollectionsForPermissiveAccess')
  it('flags collection with anyone on create/update/delete')
  it('does NOT flag collection with anyone on read only')

describe('scanForHardcodedSecrets')
  it('flags AWS access key pattern')
  it('flags generic API key assignment')
  it('does NOT flag test files')
  it('does NOT flag .env files')

describe('securityScannerPlugin')
  it('has correct name, description, domain')
  it('returns empty array when no findings')
  it('returns digest comment action when findings exist')
  it('returns create-issue action for critical findings')
  it('execute() skips issue creation when matching issue exists')
  it('all actions have 23h dedup window')
```

~20 tests total. Uses `vi.mock('fs')` and `vi.mock('glob')` (or `vi.mock('fast-glob')` depending on glob library used).

**Acceptance Criteria:**
- [ ] All tests pass with `pnpm test:unit`
- [ ] Tests cover all 4 scan functions + plugin wrapper
- [ ] Tests verify dedup and severity logic

---

### Step 9: Write Tests — `api-surface.test.ts`

**Files to Touch:**
- `tests/unit/scripts/inspector/api-surface.test.ts` (NEW)

**Test Structure:**

```
describe('discoverRoutes')
  it('finds route files and extracts methods')
  it('detects payload.auth pattern')
  it('detects requireAuth pattern')
  it('detects withApiHandler pattern')
  it('detects CRON_SECRET pattern')
  it('reports "none" when no auth pattern found')
  it('detects Zod validation (z.object, .safeParse)')
  it('detects error handling (try/catch)')
  it('detects error handling (withApiHandler)')

describe('buildCatalog')
  it('computes correct route counts')
  it('computes correct auth/unauth counts')
  it('flags POST route without Zod validation')
  it('flags route without error handling')
  it('does NOT flag GET route without validation')

describe('formatApiSurfaceDigest')
  it('includes summary stats')
  it('includes route table')
  it('includes flags section when flags exist')
  it('omits flags section when no flags')

describe('apiSurfaceAuditorPlugin')
  it('has correct name, description, domain')
  it('returns empty array when no routes found')
  it('returns digest action with catalog')
  it('all actions have 23h dedup window')
  it('execute() posts comment to digest issue')
```

~18 tests total.

**Acceptance Criteria:**
- [ ] All tests pass with `pnpm test:unit`
- [ ] Tests cover route discovery, catalog building, formatting, plugin wrapper
- [ ] Tests verify dedup and action structure

---

### Step 10: Verify Everything

**Commands:**
```bash
pnpm tsc --noEmit          # TypeScript compilation — must be clean
pnpm test:unit             # All unit tests — must pass (currently 215 files, 3495 tests)
```

**Expected After:**
- 217 test files (215 + 2 new)
- ~3533 tests (3495 + ~38 new)
- 0 new TypeScript errors

**Acceptance Criteria:**
- [ ] `pnpm tsc --noEmit` exits 0
- [ ] `pnpm test:unit` all tests pass, 17 skipped (same as before)
- [ ] No changes to existing test files

---

## Future Steps (Batch 2-5, not implemented yet)

### Batch 2: E6 (Test Coverage Gaps) + E7 (Product Metrics)
- E6: Cross-reference collections + API routes against `tests/int/` and `tests/unit/`
- E7: Count collections, globals, fields, API routes, pages, test files; track changes

### Batch 3: E2 (Schema Drift Detector) + E3 (Dependency Health)
- E2: Validate collection configs against `.ai-docs/schemas/`
- E3: Read `.ai-docs/reports/deps-security-report.md`, create issues for HIGH CVEs

### Batch 4: E4 (Dead Code Detector)
- Cross-reference exports with imports, find orphaned collection configs

### Batch 5: E8 (Architecture Reviewer) + E9 (Product Gap Analyzer)
- LLM-powered, weekly (`dedupWindowMinutes: 7 * 24 * 60`)
- E8: Reviews recent `build.md` + `spec.md` for architectural consistency
- E9: Aggregates task distribution for product insights

---

## Notes & Assumptions

1. **Glob library**: Will use Node.js `fs` with `readdirSync` recursive, or `fast-glob` / `glob` if available. Need to check `package.json` for available glob libraries. Fallback: manual recursive directory walking with `fs`.

2. **File scanning approach**: Read files line by line, apply regex rules. No AST parsing — simple string matching is sufficient for the patterns we're detecting.

3. **Collection access scanning**: Simple heuristic (import + usage co-occurrence), not full AST analysis. May have false positives if `anyone` is imported but only used for `read`. Acceptable trade-off for a scanning tool — false positives are better than false negatives for security.

4. **No LLM calls**: E1-E7 are all deterministic. No API keys required.

5. **CI ephemeral state**: `schedule: { every: 6 }` is nominal. With ephemeral CI state, plugins effectively run every cycle. Dedup window (23h) is the real throttle.

6. **Auth pattern for `cody/chat/route.ts`**: POST handler has no auth. GET handler has `requireDashboardAuth`. The scanner will flag the file because POST is a mutation without auth.

7. **`overrideAccess: true` in API routes**: Expected to be rare (most uses are in hooks/jobs/services). Any occurrence in `src/app/api/` will be flagged.
