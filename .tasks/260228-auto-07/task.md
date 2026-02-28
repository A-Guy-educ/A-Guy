# Task

## Issue Title

Replace duplicated admin auth pattern in conversion endpoints with centralized utility
## Bug

Three API routes copy-paste the same 20-line admin auth block instead of using the existing `requireAdminOrTestSecret` utility from `src/server/api/auth.ts`:

1. `src/app/api/exercises/convert/queue/route.ts` (lines 48-68)
2. `src/app/api/exercises/convert/queue-v2/route.ts` (lines 46-66)
3. `src/app/api/prompts/for-conversion/route.ts` (lines 42-63)

The duplicated code:
```typescript
let isAdmin = false
if (user && 'collection' in user && user.collection === 'users' && user.role === 'admin') {
  isAdmin = true
}
const testSecret = process.env[ENV.TEST_ADMIN_SECRET]
if (process.env[ENV.NODE_ENV] === 'test' && testSecret && authHeader === \`Bearer \${testSecret}\`) {
  isAdmin = true
}
```

Problems:
- Uses raw `'admin'` string instead of `AccountRole.Admin` enum
- Manual duck typing instead of proper `isUsersCollectionUser` type guard
- 3 copies to maintain — if auth logic changes, all must be updated
- `queue/route.ts` also uses `as any` casts (lines 125, 146) to bypass type mismatches

## Expected

Use the centralized `requireAdminOrTestSecret(user, authHeader)` from `src/server/api/auth.ts` which already handles this correctly.

## Fix

- `src/app/api/exercises/convert/queue/route.ts` — Replace manual auth with `requireAdminOrTestSecret`, fix `as any` casts
- `src/app/api/exercises/convert/queue-v2/route.ts` — Replace manual auth with `requireAdminOrTestSecret`
- `src/app/api/prompts/for-conversion/route.ts` — Replace manual auth with `requireAdminOrTestSecret`
- Optionally: `src/server/services/exercise-conversion/helpers.ts` — Tighten `validatePromptForUsageAndTenant` signature to accept nullable usage

/cody replace the duplicated admin auth pattern in src/app/api/exercises/convert/queue/route.ts, src/app/api/exercises/convert/queue-v2/route.ts, and src/app/api/prompts/for-conversion/route.ts with the centralized requireAdminOrTestSecret utility from src/server/api/auth.ts, and fix the as any casts in queue/route.ts
