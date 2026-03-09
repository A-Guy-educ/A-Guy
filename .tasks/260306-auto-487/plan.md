# Plan: Fix ExerciseAssets Access Control Security Bug

**Task ID**: 260306-auto-487
**Task Type**: fix_bug
**Risk Level**: medium

## Rerun Context

This is a rerun triggered via `/cody rerun`. The previous run did not produce a plan (the architect stage had not completed). No specific feedback was provided beyond the rerun request. This plan is being created fresh based on the task description in `task.md`.

**Approach**: The task is straightforward — change `delete` and `update` access control on ExerciseAssets from `authenticated` (any logged-in user) to `adminOnly` (admin role only). The `createdBy` field already exists on the collection, and the `adminOnly` access function already exists in the codebase. No new access control functions need to be created.

**Key insight**: The conversion pipeline that creates exercise assets uses `overrideAccess: true` (Local API default), so restricting access to `adminOnly` will NOT break internal operations. Only direct API calls from non-admin users will be blocked, which is the desired behavior.

---

## Step 1: Add Reproduction Tests for the Security Bug

**Root Cause**: `ExerciseAssets` collection uses `authenticated` for `delete` and `update` access control operations. This means any logged-in user (including students) can delete or modify ANY exercise asset in the system, not just their own.

**Files to Touch**:
- `tests/unit/collections/exercise-assets-access.test.ts` (NEW)

**Reproduction Tests** (MUST FAIL before fix, PASS after):

**Test 1**: `ExerciseAssets delete access should use adminOnly, not authenticated`
- Import the `ExerciseAssets` collection config
- Import `adminOnly` from `@/server/payload/access/adminOnly`
- Assert that `ExerciseAssets.access.delete` is the `adminOnly` function (reference equality)
- **Why it fails now**: `delete` is set to `authenticated`, not `adminOnly`

**Test 2**: `ExerciseAssets update access should use adminOnly, not authenticated`
- Import the `ExerciseAssets` collection config
- Import `adminOnly` from `@/server/payload/access/adminOnly`
- Assert that `ExerciseAssets.access.update` is the `adminOnly` function (reference equality)
- **Why it fails now**: `update` is set to `authenticated`, not `adminOnly`

**Test 3**: `ExerciseAssets create access should remain authenticated`
- Assert `ExerciseAssets.access.create` is the `authenticated` function
- **Why**: Regression guard — create must stay as `authenticated` since users need to upload assets

**Test 4**: `ExerciseAssets read access should remain anyone`
- Assert `ExerciseAssets.access.read` is the `anyone` function
- **Why**: Regression guard — read must stay as `anyone` since assets are rendered in student views

**Test 5**: `adminOnly should reject student users`
- Call `adminOnly` with a mock request containing `{ user: { role: 'student' } }`
- Assert it returns `false`
- **Why it fails now**: N/A (this test passes already, but validates the access function behavior)

**Test 6**: `adminOnly should allow admin users`
- Call `adminOnly` with a mock request containing `{ user: { role: 'admin' } }`
- Assert it returns `true`
- **Why it fails now**: N/A (this test passes already, but validates the access function behavior)

**Acceptance Criteria**:
- [ ] Tests 1 and 2 FAIL before the fix is applied
- [ ] Tests 3, 4, 5, 6 PASS before and after the fix
- [ ] All 6 tests PASS after the fix
- [ ] Test file runs via `pnpm vitest run tests/unit/collections/exercise-assets-access.test.ts`

**Estimated Time**: 10 minutes

---

## Step 2: Fix ExerciseAssets Access Control

**Root Cause**: Lines 9-12 in `src/server/payload/collections/ExerciseAssets.ts` use `authenticated` for `delete` and `update`, allowing any logged-in user to mutate any asset.

**Files to Touch**:
- `src/server/payload/collections/ExerciseAssets.ts` (MODIFIED - lines 1-2 imports, lines 9-12 access)

**Fix**:
1. Add import: `import { adminOnly } from '../access/adminOnly'`
2. Change line 10: `delete: authenticated` → `delete: adminOnly`
3. Change line 12: `update: authenticated` → `update: adminOnly`
4. Keep `create: authenticated` unchanged (users need to upload assets)
5. Keep `read: anyone` unchanged (assets must be publicly readable for rendering)

**Result after fix**:
```typescript
import { adminOnly } from '../access/adminOnly'
import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { createdByField } from '../fields/createdBy'

export const ExerciseAssets: CollectionConfig = {
  slug: 'exercise-assets',
  access: {
    create: authenticated,
    delete: adminOnly,       // Was: authenticated
    read: anyone,
    update: adminOnly,       // Was: authenticated
  },
  // ... rest unchanged
}
```

**Verification**:
- Run `pnpm vitest run tests/unit/collections/exercise-assets-access.test.ts` → ALL 6 tests PASS
- Run `pnpm vitest run tests/unit/collections/exercise-assets-config.test.ts` → existing tests still PASS
- Run `pnpm -s tsc --noEmit` → no type errors

**Acceptance Criteria**:
- [ ] `ExerciseAssets.access.delete` references `adminOnly`
- [ ] `ExerciseAssets.access.update` references `adminOnly`
- [ ] `ExerciseAssets.access.create` still references `authenticated`
- [ ] `ExerciseAssets.access.read` still references `anyone`
- [ ] TypeScript compiles without errors
- [ ] All existing tests pass

**Estimated Time**: 5 minutes

---

## Step 3: Update Vercel Blob Client Uploads Test (if needed)

**Root Cause**: The test file `tests/unit/server/payload/plugins/vercel-blob-client-uploads.test.ts` has a comment on line 28 that says `// exercise-assets: any authenticated user (matches collection access: authenticated)`. While the `clientUploads` is currently set to `false` in the plugin config (line 50 of `src/server/payload/plugins/index.ts`), the test comment is now misleading after the access control change.

**Files to Touch**:
- `tests/unit/server/payload/plugins/vercel-blob-client-uploads.test.ts` (MODIFIED - line 28 comment only)

**Fix**: Update comment on line 28 from:
```typescript
// exercise-assets: any authenticated user (matches collection access: authenticated)
```
to:
```typescript
// exercise-assets: any authenticated user can upload (create access: authenticated, but delete/update: adminOnly)
```

**Note**: This is a comment-only change. The actual `clientUploads` access logic in the test only controls upload (create) access, which remains `authenticated`. No functional test changes needed. The `clientUploads` feature is currently disabled (`clientUploads: false` in plugin config), making this purely a documentation fix.

**Verification**:
- Run `pnpm vitest run tests/unit/server/payload/plugins/vercel-blob-client-uploads.test.ts` → all existing tests still PASS
- No functional changes to test behavior

**Acceptance Criteria**:
- [ ] Comment accurately reflects the new access control
- [ ] All existing blob upload tests pass unchanged

**Estimated Time**: 5 minutes

---

## Summary

| Step | Files | Type | Tests |
|------|-------|------|-------|
| 1 | `tests/unit/collections/exercise-assets-access.test.ts` | NEW | 6 tests (2 fail before fix) |
| 2 | `src/server/payload/collections/ExerciseAssets.ts` | MODIFIED | Existing + new tests pass |
| 3 | `tests/unit/server/payload/plugins/vercel-blob-client-uploads.test.ts` | MODIFIED (comment) | Existing tests pass |

**Total estimated time**: 20 minutes

**Validation commands**:
```bash
# Run new tests
pnpm vitest run tests/unit/collections/exercise-assets-access.test.ts

# Run existing related tests
pnpm vitest run tests/unit/collections/exercise-assets-config.test.ts
pnpm vitest run tests/unit/server/payload/plugins/vercel-blob-client-uploads.test.ts

# Type check
pnpm -s tsc --noEmit

# Lint
pnpm -s lint
```
