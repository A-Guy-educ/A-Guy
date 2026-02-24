# Plan: Fix Security — Content collections use 'authenticated' instead of 'adminOnly'

**Task ID**: 260224-auto-15
**Task Type**: fix_bug
**Priority**: HIGH — Security vulnerability, privilege escalation
**Estimated Time**: ~30 minutes (1 step)

## Summary

Six content-management collections (`Courses`, `Chapters`, `Lessons`, `Categories`, `PricingPlans`, `Media`) use the `authenticated` access function for `create`, `update`, and `delete` operations. This allows **any logged-in user** (including students) to mutate administrative content. The fix replaces `authenticated` with `adminOnly` for write operations across all six collections.

## Assumptions

- **Confirmed**: `adminOnly` access function exists at `src/server/payload/access/adminOnly.ts` — checks `user.role === AccountRole.Admin`
- **Confirmed**: `AccountRole.Admin = 'admin'` exists in `src/server/payload/collections/Users/roles.ts`
- **Confirmed**: All 6 collections currently import `authenticated` from `../access/authenticated` (or `../../access/authenticated` for Media)
- The `read` access (`anyone`) stays unchanged — these are public-read collections
- No other collections besides the 6 listed need this fix (scope from task spec)

---

### Step 1: Replace `authenticated` with `adminOnly` for CUD operations in all 6 collections

**Root Cause**: The `access` block in each collection uses `authenticated` (which only checks `Boolean(user)`) for `create`, `update`, and `delete`. Any logged-in user — even a student — can create, modify, or delete courses, chapters, lessons, categories, pricing plans, and media. These are admin-only operations.

**Files to Touch**:

| File | Status | Changes |
|------|--------|---------|
| `src/server/payload/collections/Courses.ts` (lines 14-15, 27-31) | MODIFIED | Replace `authenticated` import with `adminOnly`; change `create`, `update`, `delete` to `adminOnly` |
| `src/server/payload/collections/Chapters.ts` (lines 4-5, 17-21) | MODIFIED | Replace `authenticated` import with `adminOnly`; change `create`, `update`, `delete` to `adminOnly` |
| `src/server/payload/collections/Lessons.ts` (lines 5-6, 17-21) | MODIFIED | Replace `authenticated` import with `adminOnly`; change `create`, `update`, `delete` to `adminOnly` |
| `src/server/payload/collections/Categories.ts` (lines 3-4, 10-14) | MODIFIED | Replace `authenticated` import with `adminOnly`; change `create`, `update`, `delete` to `adminOnly` |
| `src/server/payload/collections/PricingPlans.ts` (lines 3-4, 9-13) | MODIFIED | Replace `authenticated` import with `adminOnly`; change `create`, `update`, `delete` to `adminOnly` |
| `src/server/payload/collections/Media/index.ts` (lines 14-15, 91-95) | MODIFIED | Replace `authenticated` import with `adminOnly`; change `create`, `update`, `delete` to `adminOnly` |
| `tests/unit/access/content-collections-admin-only.test.ts` | NEW | Reproduction + regression test |

**Exact Changes per File**:

For each collection file:
1. **Remove** `import { authenticated } from '../access/authenticated'` (or `../../access/authenticated` for Media)
2. **Add** `import { adminOnly } from '../access/adminOnly'` (or `../../access/adminOnly` for Media)
3. **Replace** in the `access` block:
   ```typescript
   // BEFORE
   access: {
     create: authenticated,
     delete: authenticated,
     read: anyone,
     update: authenticated,
   }
   // AFTER
   access: {
     create: adminOnly,
     delete: adminOnly,
     read: anyone,
     update: adminOnly,
   }
   ```

> **Note for Courses.ts**: The `authenticated` import is also unused after the change — remove it entirely. Same for all other files.

**Reproduction Test** (`tests/unit/access/content-collections-admin-only.test.ts`):

This test directly imports the collection configs and verifies their `access` properties reference the correct function. This is a unit test that does NOT require a running Payload instance — it inspects the config objects.

```
Test: "Courses collection should use adminOnly for create/update/delete"
  - Import { Courses } from the collection config
  - Import { adminOnly } from access functions
  - Assert Courses.access.create === adminOnly
  - Assert Courses.access.update === adminOnly
  - Assert Courses.access.delete === adminOnly
  - Assert Courses.access.read === anyone (unchanged)
  Why it fails before fix: access.create/update/delete === authenticated (not adminOnly)

Test: "Chapters collection should use adminOnly for create/update/delete"
  - Same pattern as above for Chapters

Test: "Lessons collection should use adminOnly for create/update/delete"
  - Same pattern as above for Lessons

Test: "Categories collection should use adminOnly for create/update/delete"
  - Same pattern as above for Categories

Test: "PricingPlans collection should use adminOnly for create/update/delete"
  - Same pattern as above for PricingPlans

Test: "Media collection should use adminOnly for create/update/delete"
  - Same pattern as above for Media

Test: "adminOnly access function should reject non-admin users"
  - Call adminOnly with a mock user { role: 'student' }
  - Assert returns false

Test: "adminOnly access function should accept admin users"
  - Call adminOnly with a mock user { role: 'admin' }
  - Assert returns true

Test: "adminOnly access function should reject unauthenticated users"
  - Call adminOnly with user = null
  - Assert returns false
```

**Verification**:

1. Run reproduction tests → ALL FAIL before fix (access functions are `authenticated`, not `adminOnly`)
2. Apply the import + access changes to all 6 files
3. Run reproduction tests → ALL PASS after fix
4. Run `pnpm -s tsc --noEmit` → No type errors
5. Run `pnpm -s lint` → No lint errors

**Acceptance Criteria**:

- [ ] All 6 collection configs use `adminOnly` for `create`, `update`, and `delete`
- [ ] All 6 collection configs still use `anyone` for `read`
- [ ] No remaining imports of `authenticated` in the 6 modified files (unless used elsewhere in the file)
- [ ] `adminOnly` is correctly imported from the access directory in each file
- [ ] Unit tests pass confirming the correct access functions are wired
- [ ] TypeScript compiles without errors (`pnpm -s tsc --noEmit`)
- [ ] Lint passes (`pnpm -s lint`)

---

## Quality Gates

After all changes:

```bash
# 1. Run the new test file
pnpm vitest run tests/unit/access/content-collections-admin-only.test.ts

# 2. Type check
pnpm -s tsc --noEmit

# 3. Lint
pnpm -s lint
```

## Risk Assessment

- **Risk**: LOW. This is a straightforward import swap with no logic changes.
- **Rollback**: Revert import from `adminOnly` back to `authenticated` in the 6 files.
- **Side Effects**: Admin users who currently create content will continue to work. Student users who were incorrectly able to mutate content will now get 403 Forbidden. This is the **intended** behavior.
- **Media note**: The Media collection's `authenticated` import at line 15 is only used for collection-level access. The `type` field has its own inline field-level access check (lines 118-121) that already checks for admin role — this is unaffected.
