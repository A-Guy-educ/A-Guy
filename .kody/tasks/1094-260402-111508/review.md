## Verdict: PASS

## Summary

Replaces the TOCTOU-vulnerable read-check-write pattern in the access code redemption endpoint with atomic MongoDB `updateOne` operations using `$inc`/`$lt` for usage limits and `$ne`/`$push` for entitlement deduplication. Includes compensating rollback and integration tests.

## Findings

### Critical

None.

### Major

1. `src/app/api/entitlements/redeem/route.ts:99-100` — When the atomic increment filter fails (`modifiedCount === 0`), the error is always `code_exhausted`, but the filter also includes `isActive: true` and `expiresAt: { $gt: new Date() }`. If an admin deactivated the code or it expired between the early validation read and the atomic update, the user gets a misleading "exhausted" error instead of "inactive" or "expired". **Suggested fix**: Accept this as a known trade-off (documenting it in a comment) since re-reading the code to disambiguate reintroduces a non-atomic read, or return a generic `code_unavailable` error for the atomic step.

### Minor

1. `tests/int/access-code-redemption-atomic.int.spec.ts` — Tests exercise the atomic MongoDB primitives directly rather than the HTTP endpoint. This validates the core mechanism but doesn't cover the full request flow (auth, Zod validation, rollback integration). Consider adding at least one end-to-end test through the route handler in a follow-up.

2. `src/app/api/entitlements/redeem/route.ts:82` — `Record<string, unknown>` for `incrementFilter` loses type safety. Minor since MongoDB driver accepts this, but a typed interface would catch typos in filter keys at compile time.
