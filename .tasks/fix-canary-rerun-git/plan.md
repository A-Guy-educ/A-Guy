# Plan: fix-canary-rerun-git

## Research Findings

- `scripts/cody/modes/rerun.ts` ✅ exists (247 lines) — contains the bug at line 41-48
- `tests/canary/pipeline-canary.test.ts` ✅ exists (302 lines) — failing test at line 242
- `scripts/cody/git-utils.ts` ✅ exists (1006 lines) — `checkoutTaskBranch` at line 191
- `vitest.config.canary.mts` ✅ exists — canary test config

### Patterns Observed

- Canary tests use `--dry-run --local` flags to avoid LLMs, git, and network calls
- Other modes (full, impl, spec, fix) have no git calls gated on `GITHUB_ACTIONS`
- Only rerun mode calls `checkoutTaskBranch` inside a `GITHUB_ACTIONS` check
- The `commitPipelineFiles` call at line 90 already passes `dryRun: ctx.input.dryRun`

### Integration Points

- `rerun.ts` reads `ctx.input.dryRun` from the pipeline context
- `checkoutTaskBranch` is imported from `../git-utils`

## Reuse Inventory

- `ctx.input.dryRun` — existing boolean flag, already available in rerun mode context
- No new utilities needed

## Root Cause Analysis

When the canary test suite runs in GitHub Actions CI, `process.env.GITHUB_ACTIONS` is truthy.
The rerun-mode test creates a temp directory (not a git repo), `process.chdir`s into it, and
calls `main()` with `--dry-run --local`. But `runRerunMode` checks `process.env.GITHUB_ACTIONS`
(line 41) and calls `checkoutTaskBranch` without checking `input.dryRun` first. The git command
fails because the temp directory isn't a git repository.

The fix: add `!input.dryRun` to the `GITHUB_ACTIONS` guard so dry-run mode never performs git
operations.

---

### Step 1: Guard `checkoutTaskBranch` with dry-run check

**Root Cause**: `runRerunMode` calls `checkoutTaskBranch` when `GITHUB_ACTIONS` is set,
without checking `input.dryRun`. In CI, canary tests run in a temp dir (not a git repo),
so the `git branch --show-current` command inside `checkoutTaskBranch` crashes.

**Files to Touch**:

- `scripts/cody/modes/rerun.ts` (MODIFIED — line 41)

**Reproduction Test**:

The existing test `rerun-mode dry-run resumes from specified stage` in
`tests/canary/pipeline-canary.test.ts:220` already reproduces this bug.
It fails with `expected 'failed' to be 'completed'` because the git command
throws in CI.

- Test location: `tests/canary/pipeline-canary.test.ts` (line 220-250)
- Test: `rerun-mode dry-run resumes from specified stage`
- Why it fails: `checkoutTaskBranch` throws `fatal: not a git repository`

**Fix**: Change line 41 from:

```typescript
if (process.env.GITHUB_ACTIONS) {
```

to:

```typescript
if (process.env.GITHUB_ACTIONS && !input.dryRun) {
```

This ensures dry-run mode never attempts git operations, consistent with the
canary test contract: "ALL tests use --dry-run --local so no LLMs, git, or network calls are made."

**Verification**:

- Run `pnpm test:canary` → the `rerun-mode dry-run resumes from specified stage` test should PASS
- All other 5 canary tests should continue to PASS

**Acceptance Criteria**:

- [ ] `rerun-mode dry-run resumes from specified stage` test passes
- [ ] All 6 canary tests pass (0 failures)
- [ ] No behavior change for non-dry-run rerun mode in CI (GITHUB_ACTIONS branch checkout still works)
