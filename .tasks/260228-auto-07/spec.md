# Refactor: Replace Duplicated Admin Auth Pattern

## Overview

Replace duplicated admin authentication logic in three API conversion endpoints with the centralized `requireAdminOrTestSecret` utility from `src/server/api/auth.ts`.

## Problem

Three API routes copy-paste the same 20-line admin auth block instead of using the existing utility:

1. `src/app/api/exercises/convert/queue/route.ts` (lines 48-68)
2. `src/app/api/exercises/convert/queue-v2/route.ts` (lines 46-66)
3. `src/app/api/prompts/for-conversion/route.ts` (lines 42-63)

### Duplicated Code Pattern

```typescript
let isAdmin = false
if (user && 'collection' in user && user.collection === 'users' && user.role === 'admin') {
  isAdmin = true
}
const testSecret = process.env[ENV.TEST_ADMIN_SECRET]
if (process.env[ENV.NODE_ENV] === 'test' && testSecret && authHeader === `Bearer ${testSecret}`) {
  isAdmin = true
}
```

### Issues with Duplicated Pattern

- Uses raw `'admin'` string instead of `AccountRole.Admin` enum
- Manual duck typing instead of proper `isUsersCollectionUser` type guard
- 3 copies to maintain — if auth logic changes, all must be updated
- `queue/route.ts` also uses `as any` casts (lines 125, 146) to bypass type mismatches

## Requirements

1. Replace manual auth block in `src/app/api/exercises/convert/queue/route.ts` with `requireAdminOrTestSecret(user, authHeader)`
2. Replace manual auth block in `src/app/api/exercises/convert/queue-v2/route.ts` with `requireAdminOrTestSecret(user, authHeader)`
3. Replace manual auth block in `src/app/api/prompts/for-conversion/route.ts` with `requireAdminOrTestSecret(user, authHeader)`
4. Fix `as any` casts in `queue/route.ts` (lines 125, 146)

## Acceptance Criteria

- [ ] All three API routes use `requireAdminOrTestSecret` utility
- [ ] No duplicated auth logic remains in the three files
- [ ] `queue/route.ts` has no `as any` casts related to user type
- [ ] Authentication behavior remains identical (admin check + test secret fallback)
