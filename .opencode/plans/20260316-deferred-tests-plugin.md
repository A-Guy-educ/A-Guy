# Plan: Defer Test Writing to Inspector Plugin

**Created**: 2026-03-16
**Status**: Draft
**Priority**: High

---

## Problem Statement

The Cody pipeline's `test` stage runs in **parallel** with the `build` stage (TDD Red Phase). Tests are written against the *plan*, not the actual implementation. After build completes, the pipeline spends significant time in fix loops trying to reconcile tests with the actual code:

1. **Build post-action** (`run-quality-with-autofix`): Runs `pnpm -s test:unit` → tests fail because they don't match impl → re-invokes build agent (45m timeout) → re-runs gates. Up to **2 feedback loops**.
2. **Verify stage**: Runs `pnpm -s test:unit` again → if fails, triggers `fix` stage (30m timeout) → verify again. Up to **2 fix attempts**.

**Worst case: ~200 minutes** of fix loops caused by test-impl mismatches. This is the #1 source of pipeline failures and the biggest bottleneck in feature delivery.

## Solution

Remove test writing and test execution from the live pipeline entirely. Create a `deferred-tests` inspector plugin that writes tests against the **actual merged implementation** on `dev`, then opens a follow-up PR.

**Key insight**: Writing tests *after* implementation exists is fundamentally more reliable — the test agent reads actual code, not guesses from a plan.

## Prerequisites: Fix Deferred Infrastructure

> **IMPORTANT**: The existing `deferred-stages` plugin (docs) has not been working reliably. Before building the tests plugin, we must diagnose and fix the shared deferred infrastructure.

### Diagnostic Steps (Phase 0)

1. **Inspector cron firing?** — Check GitHub Actions run history for `inspector.yml` (should run every 5 min)
2. **Plugin finding eligible tasks?** — Check/add logging for tasks scanned vs matched in deferred-stages plugin
3. **Workflow dispatch succeeding?** — Verify `github.triggerWorkflow('cody.yml', ...)` actually triggers runs. Check `GH_PAT` permissions.
4. **Rerun mode working?** — When `cody.yml` runs with `mode=rerun from_stage=docs`, does the state machine correctly pick up from that stage?
5. **State persistence working?** — Does `STATE_KEY` survive across inspector runs via GitHub Actions variables? Or does it lose track and re-process/miss tasks?

Fix any issues found in the shared infrastructure before proceeding. Both plugins (docs and tests) will benefit.

---

## Implementation Plan

### Phase 1: Pipeline Changes (remove tests from live pipeline)

#### 1.1 Remove `test` from pipeline order

**File:** `scripts/cody/stages/registry.ts`

- **Line 262** (`IMPL_ORDER_STANDARD`): Change `{ parallel: ['test', 'build'] }` → `'build'`
- **Line 275** (`IMPL_ORDER_LIGHTWEIGHT`): Same change

The `test` stage definition stays in the registry (like `docs` does) so it can be triggered via `mode=rerun from_stage=test`.

#### 1.2 Remove unit test gate from build post-actions

**File:** `scripts/cody/pipeline/definitions.ts`

- **Lines 252-258**: Remove the `Unit Tests` gate from `run-quality-with-autofix`. Keep only TypeScript:

```typescript
{
  type: 'run-quality-with-autofix',
  gates: [
    { name: 'TypeScript', command: 'pnpm -s tsc --noEmit', source: 'tsc' as const },
    // Unit Tests gate removed — tests are deferred to inspector
  ],
  maxFeedbackLoops: 2,
},
```

This eliminates the 2 feedback loops (up to ~100 min) caused by test-impl mismatches.

#### 1.3 Remove unit test gate from verify stage

**File:** `scripts/cody/scripted-stages.ts`

- **Line 70**: Remove `{ name: 'Unit Tests', program: 'pnpm', args: ['-s', 'test:unit'] }` from `gateDefinitions`
- Keep: TypeScript, Lint, Format gates

#### 1.4 Update test stage prompt for deferred mode

**File:** `scripts/cody/stage-prompts.ts`

- **Lines 63-65**: Change from TDD Red Phase to post-implementation mode:

```typescript
test: () => `Write comprehensive tests for the implemented code.
Read the actual source files in src/ to understand what was built.
Write tests that validate the implementation against spec.md.
Run tests to verify they pass. Fix any failures before completing.`,
```

#### 1.5 Update review stage prompt

**File:** `scripts/cody/stage-prompts.ts`

- **Lines 82-90**: Remove "verify there is matching code AND a test" — change to just verify there is matching code. Tests won't exist at review time.

```
Before: "for every requirement in spec.md, verify there is matching code AND a test"
After:  "for every requirement in spec.md, verify there is matching code"
```

---

### Phase 2: Create Deferred Tests Inspector Plugin

#### 2.1 Create plugin

**New file:** `scripts/inspector/plugins/cody/deferred-tests/index.ts`

Modeled on `scripts/inspector/plugins/cody/deferred-stages/index.ts`:

| Property | Value |
|----------|-------|
| Name | `cody-deferred-tests` |
| Domain | `cody` |
| Schedule | Every 6 cycles (~30 min) |
| Complexity threshold | **0** (every task gets tests) |
| Dedup window | 6 hours |
| Trigger condition | Task has `pr` stage completed + no `test.md` in task dir + `test` stage not completed |
| Action | `cody.yml` workflow dispatch: `task_id=X, mode=rerun, from_stage=test` |
| Target branch | `dev` (tests written against merged code) |
| Staleness guard | Skip tasks older than 7 days (prevent testing stale/drifted code) |

The plugin will:
1. Scan `.tasks/` for completed tasks (PR stage = completed)
2. Skip tasks that already have `test.md` or `test` stage = completed
3. Skip already-processed tasks (tracked in state key `cody:deferredTestsProcessed`)
4. Skip stale tasks (> 7 days old)
5. Create workflow dispatch action to trigger test writing

#### 2.2 Register the plugin

**File:** `scripts/inspector/index.ts`

- Add import for `deferredTestsPlugin`
- Add `registry.register(deferredTestsPlugin)` after line 76 (after `deferredStagesPlugin`)

#### 2.3 Update error classifier fix instructions

**File:** `scripts/cody/pipeline/error-classifier.ts`

- The `test_failure` fix instructions currently say "update the source code (not the tests) to make them pass"
- Change to: "Fix failing test(s). The tests may not match the implementation. Update the tests to correctly reflect what the code actually does."
- In deferred mode, test failures mean the *tests* are wrong (since the source is already merged), not the source.

---

## Files Changed Summary

| File | Action | Description |
|------|--------|-------------|
| `scripts/cody/stages/registry.ts` | Modify | Remove `test` from `IMPL_ORDER_STANDARD` and `IMPL_ORDER_LIGHTWEIGHT` |
| `scripts/cody/pipeline/definitions.ts` | Modify | Remove Unit Tests gate from build post-actions |
| `scripts/cody/scripted-stages.ts` | Modify | Remove Unit Tests gate from verify stage |
| `scripts/cody/stage-prompts.ts` | Modify | Update test + review stage prompts |
| `scripts/cody/pipeline/error-classifier.ts` | Modify | Update test_failure fix instructions |
| `scripts/inspector/plugins/cody/deferred-tests/index.ts` | **Create** | New inspector plugin |
| `scripts/inspector/index.ts` | Modify | Register new plugin |

**Total: 6 files modified, 1 file created**

---

## What Changes at Runtime

### Pipeline (before → after)

```
BEFORE:
taskify → gap → clarify → architect → plan-gap → [test || build] → commit → review → fix → verify → pr
                                                                     ↑ unit tests gate    ↑ unit tests gate

AFTER:
taskify → gap → clarify → architect → plan-gap → build → commit → review → fix → verify → pr
                                                                                  ↑ no unit tests

~30 min later (inspector):
deferred-tests plugin → cody.yml rerun from_stage=test → test agent writes tests → follow-up PR to dev
```

### Gate changes

| Gate | Build Post-Actions | Verify Stage |
|------|--------------------|-------------|
| TypeScript (`tsc --noEmit`) | Kept | Kept |
| Lint | N/A | Kept |
| Format | N/A | Kept |
| **Unit Tests** | **Removed** | **Removed** |

---

## Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Worst-case fix loop time | ~200 min | ~30 min (only tsc/lint/format failures) |
| Typical pipeline time | Variable, often 60-90+ min | ~30-50 min |
| Test-impl mismatch failures | Frequent (#1 failure class) | Eliminated |
| Test quality | Plan-based (often inaccurate) | Implementation-based (accurate) |
| Test coverage gap | None | ~30 min window on `dev` |

## Trade-offs

### Accepted
- Features land on `dev` without tests for ~30 min until inspector picks them up
- Test PRs are separate from feature PRs (slightly harder to review together)

### Mitigated
- Staleness guard (7 day cutoff) prevents testing drifted code
- Dedup window (6 hours) prevents re-triggering
- Tests written against actual code are higher quality

### Not Changed
- `test` stage definition stays in `definitions.ts` (needed for `mode=rerun from_stage=test`)
- `test` stage config stays in stage registry (timeout, context files, etc.)
- Test-writer agent definitions stay (`.opencode/agents/test.md`, `.opencode/agents/test-writer.md`)
- Turbo pipeline unchanged (already doesn't have a test stage)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Inspector infra doesn't work reliably | **High** (known issue) | High — no tests written at all | Phase 0 diagnostic + fix first |
| Review agent hallucinates missing-test findings | Medium | Low — causes unnecessary fix loop | Strong prompt update |
| Stale code drift before tests arrive | Low | Medium — tests may not cover latest state | 7-day staleness guard |
| Dependent Cody tasks build on untested code | Low | Medium — cascading quality issues | Tasks are usually independent |

---

## Open Items

- [ ] Phase 0: Diagnose and fix deferred-stages infrastructure
- [ ] Determine if test PRs should auto-merge or require review
- [ ] Consider adding a dashboard indicator for "tests pending" on tasks
