# Plan: Fix Inspector WATCHDOG_ISSUE + Robustness Improvements

**Task ID**: fix-inspector-watchdog
**Task Type**: fix_bug
**Steps**: 4
**Estimated Time**: ~60 minutes

## Summary

Fix 5 bugs in the Inspector workflow: (B1/B2) digest posts to issue #0 when `WATCHDOG_ISSUE` is unset, (B3/B4) `gh issue` subcommands missing `--repo` flag, and (B5) document ephemeral state. Add tests — no existing tests for inspector.

## Assumptions

1. `WATCHDOG_ISSUE` is parsed once at startup, stored on `InspectorContext`, and consumed by plugins via `ctx` — no `process.env` reads inside execute closures.
2. The `--repo` flag uses the `repo` variable already in closure scope of `createGitHubClient`.
3. B5 (ephemeral state) is by design; we document but don't fix.
4. All tests use vitest with mocked `execFileSync` / mocked context objects — no real GitHub API calls.
5. Test directory: `tests/unit/scripts/inspector/` (new directory).

---

### Step 1: Fix digest action guard — skip when WATCHDOG_ISSUE is missing

**Root Cause**: `createDigestAction` at `health-check/index.ts:264` calls `Number(process.env.WATCHDOG_ISSUE) || 0`. When env var is unset, this evaluates to `0`, and `postComment(0, ...)` fires `gh issue comment 0` which fails silently. The digest is produced but never actually posted.

**Files to Touch**:
- `scripts/inspector/core/types.ts` (MODIFIED — lines 55-64, 130-135): Add `watchdogIssue?: number` to `InspectorContext` and `InspectorConfig`
- `scripts/inspector/index.ts` (MODIFIED — lines 22-55): Parse `WATCHDOG_ISSUE`, add startup warning, pass to config
- `scripts/inspector/core/inspector.ts` (MODIFIED — lines 54-63): Pass `watchdogIssue` from config to context
- `scripts/inspector/plugins/cody/health-check/index.ts` (MODIFIED — lines 212-269): Replace `process.env.WATCHDOG_ISSUE` read with `ctx.watchdogIssue`; return `null` if undefined

**Reproduction Test** (MUST FAIL before fix):
- **Test location**: `tests/unit/scripts/inspector/health-check.test.ts` (NEW)
- **Test 1**: `createDigestAction should return null when ctx.watchdogIssue is undefined`
  - Setup: Create mock `InspectorContext` without `watchdogIssue` field. Create array of `EvaluatedTask` with at least one failed task (so digest would normally be produced).
  - Call the digest creation logic (import and test `createDigestAction` — if not exported, test via `healthCheckPlugin.run()` and assert no digest action is returned).
  - **Why it fails now**: Currently returns an action that reads `process.env.WATCHDOG_ISSUE` and gets `0`, so the action IS returned and execute posts to issue #0.
  - **After fix**: Returns `null` when `ctx.watchdogIssue` is undefined → no digest action.

- **Test 2**: `createDigestAction should post to correct issue number when ctx.watchdogIssue is set`
  - Setup: Create mock context with `watchdogIssue: 42`. Create evaluated tasks with failures.
  - Execute the returned action, verify `ctx.github.postComment` is called with `42` as first arg.
  - **Why it fails now**: postComment is called with `Number(process.env.WATCHDOG_ISSUE) || 0` = `0` instead of `42`.
  - **After fix**: postComment called with `42`.

**Fix Details**:
1. In `core/types.ts`, add to `InspectorContext` interface (after line 63):
   ```typescript
   watchdogIssue?: number
   ```
   Add to `InspectorConfig` interface (after line 133):
   ```typescript
   watchdogIssue?: number
   ```

2. In `index.ts`, after line 26 (dryRun parsing):
   ```typescript
   const watchdogIssue = process.env.WATCHDOG_ISSUE ? Number(process.env.WATCHDOG_ISSUE) : undefined
   if (!watchdogIssue) {
     logger.warn('WATCHDOG_ISSUE not set — digest reports will be skipped')
   }
   ```
   In config object (line 50-55), add `watchdogIssue`.

3. In `core/inspector.ts`, add `watchdogIssue` to the context object (line 54-63):
   ```typescript
   watchdogIssue: config.watchdogIssue,
   ```

4. In `health-check/index.ts`, replace lines 263-264:
   ```typescript
   // Before (BUG):
   ctx.github.postComment(Number(process.env.WATCHDOG_ISSUE) || 0, ...)
   
   // After (FIX):
   // At top of createDigestAction, after healthCounts check:
   if (!ctx.watchdogIssue) {
     ctx.log.warn('WATCHDOG_ISSUE not configured — skipping digest')
     return null
   }
   // In execute closure:
   ctx.github.postComment(ctx.watchdogIssue, ...)
   ```

**Test Implementation Notes**:
- Since `createDigestAction` and `createNudgeAction` are module-private functions, tests should either:
  - (a) Export them for testing (preferred — add `export` keyword), OR
  - (b) Test through `healthCheckPlugin.run()` by mocking `discoverTasks` and inspecting returned actions
- Recommended: export `createDigestAction` and `createNudgeAction` as named exports for testability. Add a `/** @internal — exported for testing */` comment.

**Verification**:
- [ ] Test confirms `null` returned when `ctx.watchdogIssue` is undefined
- [ ] Test confirms postComment called with correct issue number when set
- [ ] No `process.env.WATCHDOG_ISSUE` reads remain inside health-check/index.ts

**Acceptance Criteria**:
- [ ] When `WATCHDOG_ISSUE` is not set, digest action is skipped with `ctx.log.warn` message
- [ ] When `WATCHDOG_ISSUE` is set to e.g. `42`, digest posts to issue #42
- [ ] No `process.env` reads inside plugin execute closures — all config comes through `ctx`

---

### Step 2: Fix nudge action guard — validate issueNumber before posting

**Root Cause**: `createNudgeAction` at `health-check/index.ts:199-204` uses `task.issueNumber` directly. If a task was discovered from a local `.tasks/` directory without a matching GitHub issue (or issue number is `0`), `postComment(0, ...)` fails silently.

**Files to Touch**:
- `scripts/inspector/plugins/cody/health-check/index.ts` (MODIFIED — lines 175-207): Add guard for `task.issueNumber`

**Reproduction Test** (MUST FAIL before fix):
- **Test location**: `tests/unit/scripts/inspector/health-check.test.ts` (same file as Step 1)
- **Test 3**: `createNudgeAction should return null when task.issueNumber is 0`
  - Setup: Create `EvaluatedTask` with `health: 'gated'`, `gatedMinutes: 60`, `issueNumber: 0`.
  - Call `createNudgeAction(task, ctx)`.
  - **Why it fails now**: Returns an action that calls `postComment(0, ...)`.
  - **After fix**: Returns `null`.

- **Test 4**: `createNudgeAction should return action for valid issueNumber`
  - Setup: Create `EvaluatedTask` with `health: 'gated'`, `gatedMinutes: 60`, `issueNumber: 123`.
  - Call `createNudgeAction(task, ctx)`.
  - Execute the action, verify `ctx.github.postComment` called with `123`.
  - **Why it fails now**: This test PASSES already (correct behavior for valid issue numbers). Include for regression.

**Fix Details**:
1. In `createNudgeAction`, add guard after line 176:
   ```typescript
   if (!task.issueNumber || task.issueNumber <= 0) {
     return null
   }
   ```

**Verification**:
- [ ] Test confirms `null` for `issueNumber: 0`
- [ ] Test confirms `null` for `issueNumber: -1` (edge case)
- [ ] Test confirms action created for `issueNumber: 123`
- [ ] Nudge still works correctly for valid gated tasks after ≥30 minutes

**Acceptance Criteria**:
- [ ] No `postComment` calls with issue number ≤ 0
- [ ] Nudge actions are created correctly for valid issue numbers
- [ ] Gated tasks under 30 minutes still return `null` (existing behavior preserved)

---

### Step 3: Add `--repo` flag to all gh CLI issue subcommands

**Root Cause**: `postComment` (line 33), `addLabel` (line 99), and `removeLabel` (line 103) in `clients/github.ts` don't pass `--repo`. They rely on CWD having a `.git` directory. In CI (GitHub Actions), CWD is a temp checkout dir which may not have proper git config. The `repo` variable is already available in the closure scope of `createGitHubClient`.

**Files to Touch**:
- `scripts/inspector/clients/github.ts` (MODIFIED — lines 32-34, 98-104): Add `--repo`, `repo` args

**Reproduction Test** (MUST FAIL before fix):
- **Test location**: `tests/unit/scripts/inspector/github-client.test.ts` (NEW)
- **Test 5**: `postComment should include --repo flag in gh CLI args`
  - Setup: Mock `execFileSync`. Create client via `createGitHubClient('owner/repo', 'fake-token')`.
  - Call `client.postComment(42, 'hello')`.
  - Assert: `execFileSync` called with args containing `'--repo'` and `'owner/repo'`.
  - **Why it fails now**: args are `['issue', 'comment', '42', '--body-file', '-']` — no `--repo`.

- **Test 6**: `addLabel should include --repo flag in gh CLI args`
  - Setup: Same mock pattern.
  - Call `client.addLabel(42, 'bug')`.
  - Assert: args contain `'--repo'` and `'owner/repo'`.
  - **Why it fails now**: args are `['issue', 'add-label', '42', 'bug']` — no `--repo`.

- **Test 7**: `removeLabel should include --repo flag in gh CLI args`
  - Setup: Same mock pattern.
  - Call `client.removeLabel(42, 'bug')`.
  - Assert: args contain `'--repo'` and `'owner/repo'`.
  - **Why it fails now**: args are `['issue', 'remove-label', '42', 'bug']` — no `--repo`.

- **Test 8**: `closeIssue already includes --repo flag` (regression test)
  - Assert: args contain `--repo=owner/repo` (already present at line 122).

**Fix Details**:
1. `postComment` (line 33): Change from:
   ```typescript
   gh(['issue', 'comment', String(issueNumber), '--body-file', '-'], body)
   ```
   To:
   ```typescript
   gh(['issue', 'comment', String(issueNumber), '--repo', repo, '--body-file', '-'], body)
   ```

2. `addLabel` (line 99): Change from:
   ```typescript
   gh(['issue', 'add-label', String(issueNumber), label])
   ```
   To:
   ```typescript
   gh(['issue', 'add-label', String(issueNumber), '--repo', repo, label])
   ```

3. `removeLabel` (line 103): Change from:
   ```typescript
   gh(['issue', 'remove-label', String(issueNumber), label])
   ```
   To:
   ```typescript
   gh(['issue', 'remove-label', String(issueNumber), '--repo', repo, label])
   ```

**Note on `--repo` format**: Use `'--repo', repo` (two separate args) instead of `--repo=${repo}` for consistency with the label arg. The `closeIssue` method already uses `--repo=${repo}` (single arg) format — either format works with `gh`. For max consistency across the client, you may normalize to either format.

**Verification**:
- [ ] Mock `execFileSync` and verify all 3 methods include `--repo`
- [ ] `closeIssue` regression test passes (already has `--repo`)
- [ ] `triggerWorkflow` regression test passes (already has `--repo=`)
- [ ] `getIssue` and `getOpenIssues` use `gh api repos/${repo}/...` pattern (no change needed — they already embed repo in the URL)

**Acceptance Criteria**:
- [ ] All `gh issue` subcommands (`postComment`, `addLabel`, `removeLabel`, `closeIssue`) pass `--repo` explicitly
- [ ] No `gh issue` subcommand relies on implicit CWD repo detection
- [ ] Existing functionality unchanged (same commands, just with explicit repo)

---

### Step 4: Add startup validation and structured logging for missing config

**Root Cause**: Inspector starts and runs all plugins even when critical configuration is missing. Operators have no visibility into what's degraded. Missing `WATCHDOG_ISSUE` causes digest to silently fail (B1/B2). Missing `MINIMAX_API_KEY` causes failure analysis to use fallback mode with no indication.

**Files to Touch**:
- `scripts/inspector/index.ts` (MODIFIED — lines 22-55): Add validation warnings at startup
- `scripts/inspector/core/inspector.ts` (MODIFIED — lines 54-63): Pass `watchdogIssue` through context (done in Step 1, verify)
- `tests/unit/scripts/inspector/inspector.test.ts` (NEW): Test startup validation

**Reproduction Test** (MUST FAIL before fix):
- **Test location**: `tests/unit/scripts/inspector/inspector.test.ts` (NEW)
- **Test 9**: `runInspector should include watchdogIssue on context when configured`
  - Setup: Mock all dependencies (state, github, pino). Create `InspectorConfig` with `watchdogIssue: 42` and an empty plugins array.
  - Call `runInspector(config)`.
  - Verify: The context passed to plugins has `watchdogIssue: 42`.
  - **Why it fails now**: `InspectorConfig` and `InspectorContext` don't have `watchdogIssue` field.

- **Test 10**: `runInspector should have watchdogIssue undefined on context when not configured`
  - Setup: Same as Test 9 but config has no `watchdogIssue`.
  - Call `runInspector(config)`.
  - Verify: The context passed to plugins has `watchdogIssue: undefined`.
  - **Why it fails now**: Same reason — field doesn't exist on types.

- **Test 11**: `main() should log warning when WATCHDOG_ISSUE is not set`
  - This is harder to test since `main()` is not exported. Alternative: test the parsing logic in isolation by extracting it to a helper, OR test via the `index.ts` module behavior.
  - **Recommended approach**: Extract config parsing into a `createInspectorConfigFromEnv()` function that can be unit-tested. If the build agent finds this too invasive, the warnings in Step 1 are sufficient — this test can verify via `runInspector` spy.

**Fix Details**:
1. In `index.ts`, add after line 26:
   ```typescript
   const watchdogIssue = process.env.WATCHDOG_ISSUE ? Number(process.env.WATCHDOG_ISSUE) : undefined
   if (!watchdogIssue) {
     logger.warn('WATCHDOG_ISSUE not set — digest reports will be skipped')
   }
   if (!process.env.MINIMAX_API_KEY) {
     logger.warn('MINIMAX_API_KEY not set — failure analysis will use fallback mode')
   }
   ```
2. Add `watchdogIssue` to config object at line 50.
3. In `core/inspector.ts`, add `watchdogIssue: config.watchdogIssue` to context at line 54-63.

**Verification**:
- [ ] Test `watchdogIssue` flows from config to context
- [ ] Test `watchdogIssue` is undefined when not configured
- [ ] `pnpm tsc --noEmit` passes (type changes are compatible)

**Acceptance Criteria**:
- [ ] Inspector logs clear startup warnings for missing optional config
- [ ] `watchdogIssue` flows: env → config → context → plugins
- [ ] No breaking changes to existing plugin API (field is optional)
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm vitest run tests/unit/scripts/inspector/` passes all tests

---

## Test Strategy

**All tests are unit tests** with mocked dependencies:
- Mock `child_process.execFileSync` for GitHub client tests
- Mock `InspectorContext` with fake `state`, `github`, and `log` for plugin tests
- Use `vi.fn()` / `vi.spyOn()` for verification
- Use `vi.mock()` for module-level mocks

**Mock InspectorContext factory** (shared across test files):

```typescript
function createMockContext(overrides?: Partial<InspectorContext>): InspectorContext {
  return {
    repo: 'owner/repo',
    dryRun: false,
    state: { get: vi.fn(), set: vi.fn(), save: vi.fn() },
    github: {
      postComment: vi.fn(),
      getIssue: vi.fn().mockReturnValue({ body: null, title: null }),
      getOpenIssues: vi.fn().mockReturnValue([]),
      triggerWorkflow: vi.fn(),
      addLabel: vi.fn(),
      removeLabel: vi.fn(),
      setLifecycleLabel: vi.fn(),
      closeIssue: vi.fn(),
      getIssueComments: vi.fn().mockReturnValue([]),
    },
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any,
    runTimestamp: new Date().toISOString(),
    cycleNumber: 1,
    ...overrides,
  }
}
```

**Test commands**:
```bash
pnpm vitest run tests/unit/scripts/inspector/
pnpm tsc --noEmit
```

## File Summary

| File | Action | Approximate Changes |
|------|--------|---------------------|
| `scripts/inspector/core/types.ts` | MODIFIED | +2 lines (add `watchdogIssue?: number` to InspectorConfig + InspectorContext) |
| `scripts/inspector/index.ts` | MODIFIED | +10 lines (parse WATCHDOG_ISSUE, add warnings, pass to config) |
| `scripts/inspector/core/inspector.ts` | MODIFIED | +1 line (pass watchdogIssue from config to context) |
| `scripts/inspector/plugins/cody/health-check/index.ts` | MODIFIED | +8 lines (guard digest + nudge actions, export functions, use ctx.watchdogIssue) |
| `scripts/inspector/clients/github.ts` | MODIFIED | +3 lines (add `--repo` to 3 methods) |
| `tests/unit/scripts/inspector/health-check.test.ts` | NEW | ~130 lines (Tests 1-4: digest + nudge guards) |
| `tests/unit/scripts/inspector/github-client.test.ts` | NEW | ~90 lines (Tests 5-8: --repo flag verification) |
| `tests/unit/scripts/inspector/inspector.test.ts` | NEW | ~70 lines (Tests 9-11: config flow + startup validation) |

## Operational Fix (Manual — Not Code)

After the code changes are merged, the repo admin must:
1. **Create a watchdog issue** in the repo (e.g., "Inspector Digest Reports")
2. **Set the `WATCHDOG_ISSUE` repo variable**: Settings → Secrets and Variables → Actions → Variables → New variable → Name: `WATCHDOG_ISSUE`, Value: `<issue-number>`

## Quality Gates

```bash
pnpm vitest run tests/unit/scripts/inspector/   # All 11 tests pass
pnpm tsc --noEmit                                 # Type check passes
```
