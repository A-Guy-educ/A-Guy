# Plan: Replace Duplicated Admin Auth Pattern with Centralized Utility

**Task ID**: 260228-auto-07
**Task Type**: refactor
**Estimated Total Time**: 30-45 minutes

## Rerun Context

This is a rerun with minimal feedback ("Rerun requested via /cody rerun"). The previous run did not produce a plan. This is the first plan for this task.

## Overview

Three API route handlers duplicate a ~20-line admin authentication block instead of using the existing `requireAdminOrTestSecret` utility from `src/server/api/auth.ts`. Additionally, `queue/route.ts` uses `as any` casts on lines 125 and 146 when calling `validatePromptForUsageAndTenant` because the `Prompt` type has `usage` as optional/nullable but the helper requires it as a required string.

## Files Involved

| File | Action | Lines |
|------|--------|-------|
| `src/app/api/exercises/convert/queue/route.ts` | MODIFIED | 1-11 (imports), 48-70 (auth block), 124-125, 145-146 (as any casts) |
| `src/app/api/exercises/convert/queue-v2/route.ts` | MODIFIED | 1-17 (imports), 46-67 (auth block) |
| `src/app/api/prompts/for-conversion/route.ts` | MODIFIED | 1-5 (imports), 42-63 (auth block) |
| `src/server/services/exercise-conversion/helpers.ts` | MODIFIED | 65-68 (signature of validatePromptForUsageAndTenant) |
| `tests/unit/server/api/auth.test.ts` | NEW | Unit tests for the centralized auth utility |
| `tests/unit/api/admin-auth-refactor.test.ts` | NEW | Tests verifying the auth utility contract is correct |

## Assumptions

1. The `requireAdminOrTestSecret` utility already exists and is well-tested (it's used by `with-api-handler.ts`). The behavior difference: the existing utility does NOT check `process.env.NODE_ENV === 'test'` — it simply checks `Bearer {TEST_ADMIN_SECRET}` (see `hasValidTestSecret` in auth.ts line 45-49). This is actually MORE correct since the test secret should be unset in production.
2. The three route files should use try/catch around `requireAdminOrTestSecret` and return the existing `errorResponse('UNAUTHORIZED', ...)` on failure, preserving the current error response shape.
3. The `as any` casts in `queue/route.ts` exist because `validatePromptForUsageAndTenant` requires `{ usage: string }` but the `Prompt` type from payload-types.ts has `usage?: ('chat' | 'extractor' | 'verifier') | null`. We'll fix the helper to accept nullable usage.

---

## Step 1: Tighten `validatePromptForUsageAndTenant` Signature to Accept Nullable Usage

**Time**: ~10 minutes

**Files to Touch**:
- `src/server/services/exercise-conversion/helpers.ts` (MODIFIED — lines 65-68)

**Exact Behavior**:
- Change the `promptDoc` parameter type from `{ status: string; usage: string; tenant: Tenant }` to `{ status: string; usage?: string | null; tenant: string | Tenant }` 
- The function already throws `PROMPT_USAGE_MISMATCH` if `promptDoc.usage !== expectedUsage`, so a `null`/`undefined` usage will naturally fail that check — no logic change needed.
- Also fix the `tenant` field type: currently typed as `Tenant` (object only) but the `Prompt` type has `tenant: string | Tenant`. Change to `string | Tenant` to match the actual Payload generated type.

**Tests** (FAIL before, PASS after):

Test location: `tests/unit/server/services/exercise-conversion/helpers.test.ts` (may already exist; add new tests)

1. **Test**: `validatePromptForUsageAndTenant throws PROMPT_USAGE_MISMATCH when usage is null`
   - Call `validatePromptForUsageAndTenant({ status: 'published', usage: null, tenant: 'tenant-1' }, 'extractor', 'tenant-1')`
   - Expect it to throw with `code: 'PROMPT_USAGE_MISMATCH'`
   - **Fails before**: TypeScript compilation error because `usage: null` doesn't match `usage: string`
   - **Passes after**: Signature accepts nullable usage, and function correctly throws mismatch

2. **Test**: `validatePromptForUsageAndTenant accepts tenant as string`
   - Call `validatePromptForUsageAndTenant({ status: 'published', usage: 'extractor', tenant: 'tenant-1' }, 'extractor', 'tenant-1')`
   - Expect it NOT to throw
   - **Fails before**: TypeScript compilation error because `tenant: 'tenant-1'` (string) doesn't match `tenant: Tenant` (object)
   - **Passes after**: Signature accepts `string | Tenant`

**Acceptance Criteria**:
- [ ] `validatePromptForUsageAndTenant` accepts `usage?: string | null` without compile error
- [ ] `validatePromptForUsageAndTenant` accepts `tenant: string | Tenant` without compile error
- [ ] Existing behavior unchanged: still throws for mismatched usage, unpublished status, tenant mismatch
- [ ] `pnpm -s tsc --noEmit` passes

---

## Step 2: Replace Duplicated Auth Block in All Three Route Files

**Time**: ~15 minutes

**Files to Touch**:
- `src/app/api/exercises/convert/queue/route.ts` (MODIFIED — lines 3, 48-70, 124-125, 145-146)
- `src/app/api/exercises/convert/queue-v2/route.ts` (MODIFIED — lines 12, 46-67)
- `src/app/api/prompts/for-conversion/route.ts` (MODIFIED — lines 1, 42-63)

**Exact Behavior for each file**:

### 2a. `queue/route.ts`

**Import change** (line 3):
- Remove: `import { ENV } from '@/server/config/constants'`
- Add: `import { requireAdminOrTestSecret } from '@/server/api/auth'`

**Auth block replacement** (lines 48-70 → ~5 lines):
Replace the 20-line manual auth block:
```typescript
// BEFORE (lines 48-70):
const { user } = await payload.auth({ headers: request.headers })
let isAdmin = false
if (user && 'collection' in user && user.collection === 'users' && user.role === 'admin') {
  isAdmin = true
}
const testSecret = process.env[ENV.TEST_ADMIN_SECRET]
const authHeader = request.headers.get('authorization')
if (process.env[ENV.NODE_ENV] === 'test' && testSecret && authHeader === `Bearer ${testSecret}`) {
  isAdmin = true
}
if (!isAdmin) {
  return errorResponse('UNAUTHORIZED', 'Admin access required', 401)
}
```

With:
```typescript
// AFTER:
const { user } = await payload.auth({ headers: request.headers })
const authHeader = request.headers.get('authorization')
try {
  requireAdminOrTestSecret(user, authHeader)
} catch {
  return errorResponse('UNAUTHORIZED', 'Admin access required', 401)
}
```

**Fix `as any` casts** (lines 124-125, 145-146):
- Remove `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comments
- Remove `as any` casts — after Step 1, `validatePromptForUsageAndTenant` accepts the Prompt type directly (nullable usage + string|Tenant)

```typescript
// BEFORE:
// eslint-disable-next-line @typescript-eslint/no-explicit-any
validatePromptForUsageAndTenant(extractorPrompt as any, 'extractor', lessonTenantId)

// AFTER:
validatePromptForUsageAndTenant(extractorPrompt, 'extractor', lessonTenantId)
```

### 2b. `queue-v2/route.ts`

**Import change** (line 12):
- Remove: `import { ENV } from '@/server/config/constants'`
- Add: `import { requireAdminOrTestSecret } from '@/server/api/auth'`

**Auth block replacement** (lines 46-67 → ~5 lines): Same pattern as 2a above.

### 2c. `for-conversion/route.ts`

**Import change** (line 1):
- Remove: `import { ENV } from '@/server/config/constants'`
- Add: `import { requireAdminOrTestSecret } from '@/server/api/auth'`

**Auth block replacement** (lines 42-63 → ~5 lines): Same pattern as 2a above.

**Tests** (FAIL before, PASS after):

Test location: `tests/unit/api/admin-auth-refactor.test.ts` (NEW)

1. **Test**: `requireAdminOrTestSecret does not throw for admin user`
   - Import `requireAdminOrTestSecret` from `@/server/api/auth`
   - Call with a mock admin user object `{ collection: 'users', role: 'admin', id: '1', ... }` and null authHeader
   - Expect it NOT to throw
   - **Purpose**: Verifies the centralized utility handles the exact user shape these routes receive

2. **Test**: `requireAdminOrTestSecret throws for non-admin user`
   - Call with `{ collection: 'users', role: 'student', id: '2', ... }` and null authHeader
   - Expect it to throw with message 'Admin access required'

3. **Test**: `requireAdminOrTestSecret does not throw for valid test secret`
   - Set `process.env.TEST_ADMIN_SECRET = 'test-secret'`
   - Call with `null` user and `'Bearer test-secret'` authHeader
   - Expect it NOT to throw
   - Clean up env var after test

4. **Test**: `requireAdminOrTestSecret throws for null user and no test secret`
   - Call with `null` user and `null` authHeader
   - Expect it to throw

**Acceptance Criteria**:
- [ ] No file imports `ENV` from `@/server/config/constants` solely for auth pattern (unless used for other constants in the same file)
- [ ] All three route files import `requireAdminOrTestSecret` from `@/server/api/auth`
- [ ] No manual `isAdmin` boolean pattern exists in any of the three files
- [ ] No `as any` casts in `queue/route.ts` for `validatePromptForUsageAndTenant` calls
- [ ] No `eslint-disable-next-line @typescript-eslint/no-explicit-any` comments for those lines
- [ ] `pnpm -s tsc --noEmit` passes
- [ ] All existing tests continue to pass: `pnpm vitest run tests/unit/api/queue-v1-validation.test.ts tests/unit/api/queue-v2-validation.test.ts`

---

## Step 3: Verify No Other Duplications and Run Full Quality Checks

**Time**: ~5 minutes

**Files to Touch**: None (verification only)

**Exact Behavior**:
- Run `grep -r "let isAdmin" src/` to verify no remaining duplicated auth pattern
- Run `pnpm -s tsc --noEmit` to verify TypeScript compilation
- Run `pnpm vitest run` to run all unit tests
- Run `pnpm -s lint` to verify linting passes

**Tests**: All existing tests must pass. No new tests needed for this step.

**Acceptance Criteria**:
- [ ] `grep -r "let isAdmin" src/` returns zero results
- [ ] `pnpm -s tsc --noEmit` exits with code 0
- [ ] `pnpm vitest run` exits with code 0
- [ ] `pnpm -s lint` exits with code 0

---

## Behavioral Notes

### Important: `requireAdminOrTestSecret` vs. duplicated pattern

The duplicated pattern checks `process.env[ENV.NODE_ENV] === 'test'` before accepting the test secret. The centralized `requireAdminOrTestSecret` does NOT check NODE_ENV — it simply checks if the auth header matches `Bearer {TEST_ADMIN_SECRET}`. This is actually **more correct**: if `TEST_ADMIN_SECRET` is unset in production (which it should be), `hasValidTestSecret` returns false regardless of NODE_ENV. The NODE_ENV check in the duplicated code was redundant defense-in-depth that the centralized utility doesn't need because it relies on the secret being absent in production.

### `as any` Cast Root Cause

The `Prompt` type (from `payload-types.ts`) has:
- `usage?: ('chat' | 'extractor' | 'verifier') | null` — optional and nullable
- `tenant: string | Tenant` — can be string ID or populated object

But `validatePromptForUsageAndTenant` expected:
- `usage: string` — required, non-null
- `tenant: Tenant` — object only

After Step 1 fixes the signature, the `Prompt` type is directly compatible, eliminating the need for `as any` casts.

---

## Summary of Changes

| File | Change | Lines Removed | Lines Added |
|------|--------|--------------|-------------|
| `helpers.ts` | Widen param types | 1 | 1 |
| `queue/route.ts` | Replace auth + remove casts | ~24 | ~7 |
| `queue-v2/route.ts` | Replace auth | ~20 | ~6 |
| `for-conversion/route.ts` | Replace auth | ~20 | ~6 |
| `auth.test.ts` | New tests | 0 | ~50 |
| `helpers.test.ts` | New tests | 0 | ~30 |

**Net reduction**: ~50 lines of duplicated code removed, ~20 lines of tests added for the centralized utility contract.
