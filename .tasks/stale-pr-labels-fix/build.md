# Build Agent Report: stale-pr-labels-fix

## Changes

- `src/app/api/cody/tasks/route.ts` — Removed PR label reading from dashboard column derivation:
  - Removed `prLabelNames` variable that extracted labels from associated PRs
  - Removed `allLabels` merge of issue + PR labels
  - Removed PR label override logic in `getColumnForIssue()` (lines 85-97, 105-106)
  - Removed special PR gate label handling in column derivation (lines 262-269)
  - Simplified column derivation to use only pipeline status + issue labels
  - Changed `let column` to `const column` (lint fix)

- `tests/unit/cody-column-derivation.test.ts` — Updated tests to reflect new behavior:
  - Rewrote `deriveColumnFromLabels()` to ignore PR labels
  - Removed tests for PR label override behavior
  - Added tests verifying issue labels take precedence
  - Added tests verifying PR labels are ignored for column derivation

## Tests Written

- `tests/unit/cody-column-derivation.test.ts` — 20 tests covering column derivation from issue labels only

## Deviations

- None — plan followed exactly

## Quality

- TypeScript: PASS (no errors in modified files)
- Lint: PASS
- Unit Tests: 20/20 column derivation tests pass

## Summary

Fixed stale PR labels bug by removing PR label reading from dashboard column derivation. The pipeline only writes labels to issues (not PRs), so reading PR labels for column state was causing phantom/stale labels in the dashboard. Now using issue labels as single source of truth.
