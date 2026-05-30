## Merge Conflict Resolution — PR #1564 (1505-doc-drift-srclibaicron)

### What I did
Resolved two symmetric conflicts in test fixture files — both involved the `transactionId` field in `courseEntitlements` test data:

- `tests/int/course-entitlement-cascade-delete.int.spec.ts` — `createUserWithEntitlements` helper
- `tests/int/dashboard-metrics.int.spec.ts` — enrollment specs loop

### How I resolved each conflict
**Both conflicts were identical in nature:** HEAD used `admin-${id}` while `origin/dev` used `test-txn-${id}-${Date.now()}-${i}`. These are purely test fixture values with no semantic difference. Took the HEAD side (cleaner, matches PR intent).

### Note
`pnpm typecheck` fails with a stale `src/payload-types.ts` error — this is pre-existing from the merge and unrelated to the conflict resolution.
