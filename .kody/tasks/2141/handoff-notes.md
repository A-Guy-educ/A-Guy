## 2141 — Super-admin rate limit exemption fix

### Root cause

The `isSuperAdmin` function in `src/app/api/payments/checkout/route.ts` was changed from checking `user.roles.includes('super-admin')` (plural array with string `'super-admin'`) to `user.role === AccountRole.Admin` (singular enum).

However, `payload.auth()` may return a user object that has the `roles` array containing `'super-admin'` in some authentication flows, not just the singular `role: AccountRole.Admin`. The singular check alone caused `isSuperAdmin` to return `false` for super-admin users, making the rate limit fire (429) instead of being bypassed.

### Fix applied

Updated `isSuperAdmin` to check both:
1. `user.role === AccountRole.Admin` (for the singular role field)
2. `user.roles.includes('super-admin')` (for the roles array, backward compat)

This ensures super-admin users are correctly exempted from the checkout rate limit regardless of which form `payload.auth()` returns.
