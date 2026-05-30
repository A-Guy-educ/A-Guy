# Merge Conflict Resolution for #1377 (docs/testing-patterns-for-route-handlers)

## What was done

Resolved `git merge origin/dev` conflicts in two test files:

1. `tests/int/course-entitlement-cascade-delete.int.spec.ts` — conflict in `createUserWithEntitlements` helper at the `transactionId` field
2. `tests/int/dashboard-metrics.int.spec.ts` — conflict in `courseEntitlements` data at the `transactionId` field

## Resolution rationale

Both conflicts had identical content: the PR used `test-tx-${id}` (simple) while `origin/dev` used `test-txn-${id}-${Date.now()}-${i}` (timestamp + index). The dev version is more unique — critical because some tests create users with entitlements to multiple courses, and duplicate `transactionId` values could cause test flakiness or masking of real bugs. Took the dev side for both.

## Verification

- `grep` confirms no `<<<<<<<`, `=======`, or `>>>>>>>` markers remain
- `pnpm typecheck --noEmit` passes
- `npx eslint` on both files passes with no errors
