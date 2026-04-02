### taskify (2026-04-02T11:17:46)

Perfect! I've created a detailed implementation plan. Here's a summary:

## Plan Summary

**Problem**: Two TOCTOU race conditions in the redemption endpoint:

1. Over-redemption: Multiple requests can both see `currentUses < maxUses` and both increment
2. Duplicate entitlements: Multiple requests can both add the same course entitlement

**Solution**: Use atomic MongoDB operations to close both race windows:

### Key Changes:

1. **Atomic access code increment** using `findOneAndUpdate` with `$inc
   ...(truncated)

### plan (2026-04-02T11:26:36)
Implementation is complete. Here's a summary of what was done:

## Changes Summary

### `src/app/api/entitlements/redeem/route.ts` (main fix)

**Race condition 1 — Over-redemption**: Replaced the non-atomic read-check-write pattern with an atomic `updateOne` using `$inc` and a conditional filter:
- `currentUses: { $lt: maxUses }` ensures only one request can claim the last use
- `isActive: true` and `expiresAt: { $gt: new Date() }` are included in the atomic filter to prevent races with admin de
...(truncated)

### build (2026-04-02T11:27:53)
All 6 tests pass. The implementation is complete and verified:

**What was fixed:**

- **Over-redemption (TOCTOU #1)**: Replaced read-check-write with an atomic `updateOne` using `$inc` + `currentUses: { $lt: maxUses }` filter. Only the first concurrent request wins; `modifiedCount === 0` returns 409.

- **Duplicate entitlements (TOCTOU #2)**: Replaced the `alreadyHas` check + array spread with an atomic `updateOne` using `'courseEntitlements.course': { $ne: courseObjectId }` as a guard. If the 
...(truncated)

### review (2026-04-02T11:30:20)
## Verdict: PASS

## Summary

Replaces the TOCTOU-vulnerable read-check-write pattern in the access code redemption endpoint with atomic MongoDB `updateOne` operations using `$inc`/`$lt` for usage limits and `$ne`/`$push` for entitlement deduplication. Includes compensating rollback and integration tests.

## Findings

### Critical

None.

### Major

1. `src/app/api/entitlements/redeem/route.ts:99-100` — When the atomic increment filter fails (`modifiedCount === 0`), the error is always `code_ex
...(truncated)

### review-fix (2026-04-02T11:31:36)
All 6 tests still pass.

**Fix applied**: Changed the error code from `code_exhausted` to `code_unavailable` at line 99-100, with a comment explaining the trade-off. This prevents the misleading error when the atomic update fails due to `isActive`/`expiresAt` changes rather than usage exhaustion.

