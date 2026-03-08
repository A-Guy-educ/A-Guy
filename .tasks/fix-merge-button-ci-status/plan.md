# Plan: Fix Merge Button Showing "CI Failed" When CI Is Green

**Task Type**: fix_bug
**Task ID**: fix-merge-button-ci-status
**Estimated Total**: 30–60 minutes (2 steps)

---

## Root Cause Analysis

The Cody dashboard merge button for issue #694 shows "CI failed" (disabled) even though CI is actually green. There are **three interacting bugs** in the CI status resolution pipeline:

### Bug 1: `resolveCommitCIStatus` treats ANY failed check run as overall failure (Primary)
**File**: `src/ui/cody/github-client.ts` lines 1462–1470
**Problem**: The function checks ALL check runs on a commit SHA and if **any single one** has `conclusion === 'failure'` or `'timed_out'`, it returns `'failure'` — even if that check is non-essential, stale, or from a different workflow. For example, if there's a deployment status check or code scanning check that failed, but the actual CI workflow (e.g., `build-and-test`) passed, the function reports failure.
**Evidence**: The comment on lines 1390-1392 acknowledges this repo has no branch protection, meaning `mergeable_state` is always `'blocked'`, so this fallback `resolveCommitCIStatus` is the **primary** path for determining CI status.

### Bug 2: Polling stops permanently once status settles at `'failure'`
**File**: `src/ui/cody/hooks/usePRCIStatus.ts` lines 18–21
**Problem**: `refetchInterval` returns `false` (stop polling) when status is anything other than `'running'` or `'pending'`. Once the API returns `'failure'` (even transiently due to Bug 1), the hook **stops polling forever**. The user must manually refresh the page to get an updated status. If CI was temporarily failing and later passes, the UI never updates.

### Bug 3: `'dirty'` mergeable_state reports as CI failure (misleading)
**File**: `src/ui/cody/github-client.ts` lines 1404–1406
**Problem**: When `mergeable_state === 'dirty'` (merge conflicts), the function sets `ciStatus = 'failure'`. The tooltip then shows "CI Failed" when the real issue is merge conflicts — not CI. This is misleading but secondary.

---

## Assumptions

- The primary CI check is a GitHub Actions workflow (check runs via Checks API)
- Non-essential checks (deploy previews, code scanning, etc.) may exist and fail without blocking mergeability
- The repo has no branch protection rules, so `mergeable_state` is consistently `'blocked'`
- Issue #694's PR has a passing CI workflow but a failing non-essential check run causing the false negative

---

## Step 1: Fix `resolveCommitCIStatus` to only consider relevant CI check runs AND fix dirty state messaging

**Root Cause**: `resolveCommitCIStatus` treats ALL check runs equally. A single failed non-essential check (deploy preview, code scanning, stale re-run) marks the entire PR as CI failed.

**Files to Touch**:
- `src/ui/cody/github-client.ts` (MODIFIED — lines 1436–1488, 1404–1406)

**Reproduction Test**: Write a test that demonstrates the bug (MUST FAIL now):
- Test location: `tests/unit/ui/cody/ci-status-resolution.test.ts` (NEW)
- Test 1: `resolveCommitCIStatus returns 'success' when main CI passes but a non-essential check fails`
  - Mock `octokit.repos.getCombinedStatusForRef` → returns `{ state: 'success', statuses: [] }`
  - Mock `octokit.checks.listForRef` → returns two check runs:
    - `{ name: 'build-and-test', status: 'completed', conclusion: 'success' }`
    - `{ name: 'deploy-preview', status: 'completed', conclusion: 'failure' }`
  - Call `resolveCommitCIStatus(octokit, 'abc123')`
  - Expect: `'success'` (currently returns `'failure'` due to the bug)
  - Why it fails: Current code uses `.some()` on ALL check runs, so the `deploy-preview` failure overrides

- Test 2: `resolveCommitCIStatus returns 'success' when a failed check run is superseded by a newer successful run of the same check`
  - Mock check runs with two entries for same check name:
    - `{ name: 'CI', status: 'completed', conclusion: 'failure', started_at: '2025-01-01T00:00:00Z' }`
    - `{ name: 'CI', status: 'completed', conclusion: 'success', started_at: '2025-01-01T01:00:00Z' }`
  - Expect: `'success'` (currently returns `'failure'` because `.some()` finds the old failure)

- Test 3: `fetchPRCIStatus returns 'failure' with a distinct conflict indicator when mergeable_state is 'dirty'`
  - Mock `octokit.pulls.get` → returns `{ mergeable_state: 'dirty', mergeable: false }`
  - Call `fetchPRCIStatus(694)`
  - Expect: result should have `ciStatus: 'failure'` AND `hasConflicts: true` (new field)

**Fix**:

1. **Filter check runs by relevance**: In `resolveCommitCIStatus`, deduplicate check runs by name, keeping only the **latest** run per check name (by `started_at` or `completed_at`). This handles stale re-runs where an older run failed but the latest passed.

2. **Only consider the combined status API state for commit statuses**: The `combinedStatus.state` already aggregates statuses correctly. For check runs, only consider the latest run per unique check name.

3. **Add `hasConflicts` field**: When `mergeable_state === 'dirty'`, return `{ ciStatus: 'failure', mergeable: false, hasConflicts: true }` so the UI can show "Merge Conflicts" instead of "CI Failed".

4. **Update the return type** of `fetchPRCIStatus` to include optional `hasConflicts: boolean`.

**Acceptance Criteria**:
- [ ] `resolveCommitCIStatus` only considers the latest run per unique check name
- [ ] A single non-essential failed check does not mark overall CI as failed when combined status is success
- [ ] Stale/superseded check runs are ignored in favor of the latest run
- [ ] `fetchPRCIStatus` returns `hasConflicts: true` when `mergeable_state === 'dirty'`
- [ ] All 3 reproduction tests pass
- [ ] Existing test file `tests/unit/ui/cody/github-client-optimization.test.ts` still passes

---

## Step 2: Fix polling to continue after transient failure AND update UI to distinguish conflicts from CI failure

**Root Cause**: The `usePRCIStatus` hook stops polling (`refetchInterval: false`) once status is `'failure'`. Combined with Bug 1, a transient or stale failure becomes permanent in the UI until manual page refresh. Additionally, the tooltip shows "CI Failed" for merge conflicts, which is misleading.

**Files to Touch**:
- `src/ui/cody/hooks/usePRCIStatus.ts` (MODIFIED — lines 18–21)
- `src/ui/cody/components/MergeButton.tsx` (MODIFIED — lines 49–50, to handle `hasConflicts`)
- `src/ui/cody/components/tooltip-content.tsx` (MODIFIED — lines 156–186, to show "Merge Conflicts" vs "CI Failed")
- `src/ui/cody/components/CIStatusBadge.tsx` (MODIFIED — line 24, to add `conflicts` status config)
- `src/ui/cody/types.ts` (MODIFIED — line 192, update `ciStatus` type)
- `src/app/api/cody/prs/status/route.ts` (NO CHANGE — already passes through full response)

**Reproduction Test**: Write tests that demonstrate the bugs (MUST FAIL now):
- Test location: `tests/unit/ui/cody/ci-status-polling.test.ts` (NEW)

- Test 1: `usePRCIStatus continues polling when status is 'failure' (slow poll)`
  - Render hook with a mock API that returns `{ ciStatus: 'failure', mergeable: false }`
  - Assert `refetchInterval` is NOT `false` — it should be a slow interval (e.g., 30s) to allow recovery
  - Why it fails: Current code returns `false` for any status that isn't `'running'`/`'pending'`

- Test 2: `MergeTooltipContent shows 'Merge Conflicts' when hasConflicts is true`
  - Render `<MergeTooltipContent canMerge={false} ciStatus="failure" hasConflicts={true} />`
  - Assert text contains "Merge Conflicts" or "conflicts"
  - Why it fails: Current component doesn't accept or handle `hasConflicts` prop

- Test 3: `MergeTooltipContent shows 'CI Failed' when hasConflicts is false and ciStatus is failure`
  - Render `<MergeTooltipContent canMerge={false} ciStatus="failure" hasConflicts={false} />`
  - Assert text contains "CI Failed"
  - This should already pass (baseline behavior preserved)

**Fix**:

1. **Change polling strategy** in `usePRCIStatus.ts`:
   - `'running'` or `'pending'` → poll every 10s (fast, unchanged)
   - `'failure'` → poll every 30s (slow recovery poll — allows detection when CI re-runs pass)
   - `'success'` → stop polling (`false`) — this is the only truly settled state

2. **Pass `hasConflicts`** through the hook data to `MergeButton` and `MergeTooltipContent`:
   - `MergeButton.tsx`: Extract `hasConflicts` from `data?.hasConflicts ?? false`
   - `MergeTooltipContent`: Accept `hasConflicts` prop, show "⚠️ Merge Conflicts" with description "This PR has merge conflicts that must be resolved before merging." instead of "CI Failed" when `hasConflicts` is true
   - `CIStatusTooltipContent`: Also handle `hasConflicts` case

3. **Update types**: The API response type already flows through correctly since the route just passes through the `fetchPRCIStatus` return value.

**Acceptance Criteria**:
- [ ] Hook continues slow-polling (30s) when CI status is `'failure'`
- [ ] Hook stops polling only when CI status is `'success'`
- [ ] Tooltip shows "Merge Conflicts" (not "CI Failed") when `hasConflicts` is true
- [ ] Tooltip still shows "CI Failed" when actual CI failed (no conflicts)
- [ ] All 3 reproduction tests pass
- [ ] `MergeButton` correctly passes `hasConflicts` to tooltip
- [ ] TypeScript compiles without errors (`pnpm tsc --noEmit`)
- [ ] Existing tests still pass (`pnpm test:unit`)

---

## Verification Checklist

After both steps:
1. Run `pnpm tsc --noEmit` — no type errors
2. Run `pnpm test:unit` — all tests pass (including new tests)
3. Run `pnpm lint` — no lint errors
4. Manual verification: Navigate to Cody dashboard, find a PR with mixed check run results → merge button should be enabled if main CI passes
5. Manual verification: PR with merge conflicts → tooltip should say "Merge Conflicts" not "CI Failed"

---

## Files Summary

| File | Action | Lines |
|------|--------|-------|
| `src/ui/cody/github-client.ts` | MODIFIED | 1353–1488 (fetchPRCIStatus + resolveCommitCIStatus) |
| `src/ui/cody/hooks/usePRCIStatus.ts` | MODIFIED | 18–21 (refetchInterval logic) |
| `src/ui/cody/components/MergeButton.tsx` | MODIFIED | 46–50 (extract hasConflicts) |
| `src/ui/cody/components/tooltip-content.tsx` | MODIFIED | 75–114, 156–186 (conflicts messaging) |
| `src/ui/cody/components/CIStatusBadge.tsx` | MODIFIED | 20–25 (optional conflicts config) |
| `tests/unit/ui/cody/ci-status-resolution.test.ts` | NEW | ~120 lines |
| `tests/unit/ui/cody/ci-status-polling.test.ts` | NEW | ~80 lines |
