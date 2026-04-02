# Bug: Access code redemption TOCTOU race condition allows over-redemption

## Bug Description

The access code redemption endpoint in `src/app/api/entitlements/redeem/route.ts` has a Time-Of-Check-Time-Of-Use (TOCTOU) race condition. The code:

1. **Reads** `currentUses` (line 70)
2. **Checks** if `currentUses >= maxUses` (line 71)
3. **Writes** `currentUses + 1` much later (line 121)

Between the read and the write, another concurrent request can read the same `currentUses` value.

```typescript
// Line 69-72: Read then check — race window begins
const maxUses = accessCode.maxUses ?? 0
const currentUses = accessCode.currentUses ?? 0
if (maxUses > 0 && currentUses >= maxUses) {
  return NextResponse.json(...)
}

// Lines 86-96: Duplicate entitlement check also has TOCTOU
const alreadyHas = existing.some(...)

// Lines 99-123: Write happens much later — race window ends
await payload.update({ ... data: { currentUses: currentUses + 1 } })
```

This means:

- **Access codes can be over-redeemed** beyond `maxUses`. If `maxUses` is 1 and two users redeem simultaneously, both see `currentUses === 0`, both pass the check, and both get the entitlement.
- **A user can get a duplicate entitlement**. The `alreadyHas` check suffers from the same TOCTOU issue.

## Impact

**Financial / data corruption**. Access codes with limited uses can be exhausted beyond their intended limit. Users can also get duplicate course entitlements.

## Suggested Fix

Use an atomic MongoDB operation (`$inc` on `currentUses` with a `where` filter that includes `currentUses: { less_than: maxUses }`) to make the check-and-increment atomic. Check the `modifiedCount` to determine if the increment was applied. For the entitlement deduplication, add a unique compound index on (user, course).

Example approach:

```typescript
// Atomic compare-and-increment
const result = await payload.db.collections['access-codes'].updateOne(
  { _id: accessCode.id, currentUses: { $lt: maxUses } },
  { $inc: { currentUses: 1 } },
)
if (result.modifiedCount === 0) {
  return NextResponse.json({ error: 'Access code fully redeemed' }, { status: 409 })
}
```

## Complexity

Hard — requires changing the redemption flow to use atomic database operations, understanding Payload CMS's underlying MongoDB driver access, and adding a unique compound index for entitlement deduplication. Needs careful testing for concurrent scenarios.
