# Plan: Fix preventLastAdminDemotion hook — overrideAccess bug

**Task ID**: 260226-fix-admin-demotion-hook
**Task Type**: fix_bug
**Priority**: HIGH — Security bug allowing last admin demotion

---

## Summary

The `preventLastAdminDemotion` beforeChange hook counts admins using `overrideAccess: false`, which means the count query is filtered by the current user's access control. If a non-admin (or a user whose access control hides other admin records) triggers this code path, `adminCount` may return 0 — incorrectly allowing the last admin to be demoted. The fix is a one-line change: `overrideAccess: false` → `overrideAccess: true`.

## Assumptions

- No `clarified.md` or `rerun-feedback.md` exist — this is the first run.
- The spec says "no unit tests exist for this hook." We will CREATE a unit test as the reproduction test — this is the TDD bug-fix approach.
- The Users collection access control may restrict which users a non-admin can see, so `count` with `overrideAccess: false` could return 0 for a non-admin caller.

---

## Spec Requirements Reference

- **AC-1**: Change `overrideAccess: false` to `overrideAccess: true` on line 27
- **AC-2**: TypeScript compilation passes

---

### Step 1: Create test directory

**Description**: Create the necessary directory for the new unit test file.

**Files to Touch**:
- `tests/unit/collections/` (NEW DIRECTORY)

**Verification**:
1. Run `ls tests/unit/collections/` → directory exists.

**Time Estimate**: 1 minute

### Step 2: Write reproduction test + apply fix

**Root Cause**: `preventLastAdminDemotion` hook calls `req.payload.count()` with `overrideAccess: false`. This means the count is filtered by the calling user's access control. If access control restricts visibility (e.g., a non-admin can't see other admins), the count returns 0, and the hook incorrectly allows demotion of the last admin.

**Files to Touch**:

- `tests/unit/collections/preventLastAdminDemotion-hook.test.ts` (NEW)
- `src/server/payload/collections/Users/hooks/preventLastAdminDemotion-hook.ts` (MODIFIED — line 27)

**Reproduction Test** (`tests/unit/collections/preventLastAdminDemotion-hook.test.ts`):

This test file will import the hook and exercise it with mock `req` objects. The key reproduction test:

1. **Test: "should call count with overrideAccess: true (system-level check)"**
   - Create a mock `req.payload.count` that records the arguments it's called with.
   - Invoke `preventLastAdminDemotion` with:
     - `operation: 'update'`
     - `data: { role: 'student' }` (demoting)
     - `originalDoc: { role: 'admin' }` (was admin)
   - Mock `count` returns `{ totalDocs: 2 }` (multiple admins — demotion allowed).
   - **Assert**: `req.payload.count` was called with `overrideAccess: true`.
   - **Why it fails now**: The current code passes `overrideAccess: false`, so the assertion on `overrideAccess: true` will fail.

2. **Test: "should throw ValidationError when demoting the last admin"**
   - Mock `count` returns `{ totalDocs: 1 }`.
   - Invoke hook with same demotion scenario.
   - **Assert**: throws `ValidationError` with message containing 'Cannot demote the last admin'.

3. **Test: "should allow demotion when multiple admins exist"**
   - Mock `count` returns `{ totalDocs: 3 }`.
   - Invoke hook.
   - **Assert**: returns data without throwing.

4. **Test: "should skip check on create operations"**
   - Invoke with `operation: 'create'`.
   - **Assert**: `count` is never called, data returned as-is.

5. **Test: "should skip check when role is not changing to student"**
   - Invoke with `data: { role: 'admin' }`.
   - **Assert**: `count` is never called.

6. **Test: "should skip check when original role is not admin"**
   - Invoke with `originalDoc: { role: 'student' }`, `data: { role: 'student' }`.
   - **Assert**: `count` is never called.

**Fix**: In `src/server/payload/collections/Users/hooks/preventLastAdminDemotion-hook.ts`, line 27:

```diff
-    overrideAccess: false,
+    overrideAccess: true,
```

**Verification**:

1. Run reproduction test BEFORE fix → Test 1 ("overrideAccess: true") FAILS (current code uses `false`)
2. Apply the one-line fix
3. Run reproduction test AFTER fix → ALL tests PASS
4. Run `pnpm -s tsc --noEmit` → passes
5. Run full unit test suite `pnpm test:unit` → passes

**Acceptance Criteria**:

- [ ] New test file `tests/unit/collections/preventLastAdminDemotion-hook.test.ts` exists with ≥ 6 test cases
- [ ] Test 1 asserts `overrideAccess: true` is passed to `payload.count`
- [ ] `overrideAccess` changed from `false` to `true` on line 27 of the hook
- [ ] `pnpm -s tsc --noEmit` passes (AC-2)
- [ ] `pnpm test:unit` passes — all new tests green
- [ ] No other files modified

**Time Estimate**: 10-15 minutes

---

## Test Implementation Notes for Build Agent

### Mock Structure

The hook is a `CollectionBeforeChangeHook`. Create mock args matching this pattern (follow the convention in `tests/unit/collections/exercises-hooks.test.ts`):

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { preventLastAdminDemotion } from '@/server/payload/collections/Users/hooks/preventLastAdminDemotion-hook'
import { AccountRole } from '@/server/payload/collections/Users/roles'

const mockCount = vi.fn()

const createHookArgs = (overrides: Record<string, unknown> = {}): any => ({
  data: { role: AccountRole.Student },
  operation: 'update',
  originalDoc: { role: AccountRole.Admin },
  req: {
    payload: { count: mockCount },
  },
  ...overrides,
})
```

### Key assertion for the reproduction test

```typescript
it('should call count with overrideAccess: true (system-level visibility)', async () => {
  mockCount.mockResolvedValue({ totalDocs: 2 })
  const args = createHookArgs()
  await preventLastAdminDemotion(args)
  expect(mockCount).toHaveBeenCalledWith(
    expect.objectContaining({ overrideAccess: true })
  )
})
```

### Run Commands

```bash
# Run just the new test
pnpm test:unit -- --reporter=verbose tests/unit/collections/preventLastAdminDemotion-hook.test.ts

# Type check
pnpm -s tsc --noEmit

# Full unit suite
pnpm test:unit
```

---

## Quality Gates

1. **Type check**: `pnpm -s tsc --noEmit` — must pass
2. **Unit tests**: `pnpm test:unit` — must pass (includes new test file)
3. **Lint**: `pnpm -s lint` — must pass
