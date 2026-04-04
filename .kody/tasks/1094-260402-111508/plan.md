Implementation is complete. Here's a summary of what was done:

## Changes Summary

### `src/app/api/entitlements/redeem/route.ts` (main fix)

**Race condition 1 — Over-redemption**: Replaced the non-atomic read-check-write pattern with an atomic `updateOne` using `$inc` and a conditional filter:

- `currentUses: { $lt: maxUses }` ensures only one request can claim the last use
- `isActive: true` and `expiresAt: { $gt: new Date() }` are included in the atomic filter to prevent races with admin deactivation/expiration

**Race condition 2 — Duplicate entitlements**: Replaced the non-atomic `alreadyHas` check + array spread with an atomic `updateOne` using:

- `'courseEntitlements.course': { $ne: courseObjectId }` as a filter condition
- `$push` to atomically add the entitlement only if the course isn't already present

**Error handling**:

- Full try/catch around atomic operations
- Rollback of access code increment if entitlement step fails (with `$gt: 0` floor guard)
- Error logging via `payload.logger.error` for failed rollbacks

### `tests/int/access-code-redemption-atomic.int.spec.ts` (new)

Integration tests verifying:

1. Concurrent increment prevention (maxUses=1 with 2 concurrent requests → exactly 1 succeeds)
2. Multi-use codes (maxUses=3 with 5 concurrent → exactly 3 succeed)
3. Unlimited codes (maxUses=0 → all succeed)
4. Duplicate entitlement prevention (2 concurrent adds → exactly 1 succeeds)
5. Different courses on same user (both succeed)
6. Rollback when user already has entitlement (currentUses returns to 0)
