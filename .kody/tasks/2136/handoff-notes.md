# 2136 — Per-User Rate Limit on Checkout Endpoint

## What was done

Added per-user rate limiting to `src/app/api/payments/checkout/route.ts` using the existing `checkAuthenticatedRateLimit` utility from `@/server/services/rate-limit`.

**Config**: 10 requests per 5 minutes per user (`CHECKOUT_RATE_LIMIT_CONFIG = { maxRequests: 10, windowMs: 300_000 }`).

**Placement**: After auth check (step 1) and before body parsing (step 2) — unauthenticated users get 401, not 429. Provider API is never called on rate-limited requests.

**Super-admin bypass**: Users with `roles: ['super-admin']` skip the rate limit check entirely.

**Rate-limit hit response**: `429 Too Many Requests` with `{ success: false, error: 'rate_limit_exceeded' }` and `Retry-After` header. Logged via `payload.logger.warn({ userId, requestCount: 10 }, 'Checkout rate limit exceeded')`.

**Integration test**: `tests/int/checkout-rate-limit.int.spec.ts` covers all 4 acceptance criteria:
1. 11th request returns 429 + Retry-After
2. Unauthenticated gets 401
3. Provider not called on rate-limited request (mock spy verified)
4. Super-admin exempt from rate limit

## Key note on super-admin

The `isSuperAdmin` function checks `user.roles` (plural, array) for `'super-admin'`. The Users collection schema only defines `role` (singular enum). The `roles` array field is created ad-hoc via `overrideAccess: true` on user creation in the test, and exists on the user doc returned by `payload.auth()`. This is how the existing `isSuperAdmin` works — no schema change was needed.
