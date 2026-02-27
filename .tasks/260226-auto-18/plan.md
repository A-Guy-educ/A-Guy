# Plan: Fix Draft Content Publicly Readable via API

**Task ID:** 260226-auto-18
**Task Type:** fix_bug
**Priority:** HIGH — Data leak, unpublished content visible to public

## Rerun Context

Rerun triggered without specific code-level feedback (`/cody rerun`). Previous plan did not exist. This is effectively a fresh plan for the bug fix.

---

## Problem Summary

The `courses`, `chapters`, and `lessons` collections all use `read: anyone` which returns `true` for all users — including anonymous/unauthenticated API consumers. This means draft and archived content is publicly readable via `GET /api/courses`, `GET /api/chapters`, and `GET /api/lessons`.

These collections have a custom `status` field (not Payload's built-in `_status` from drafts system) with options `draft | published | archived`. The existing `authenticatedOrPublished` access function in `src/server/payload/access/authenticatedOrPublished.ts` uses `_status` and is NOT suitable here.

---

## Root Cause

All three collection configs set `read: anyone` (imported from `src/server/payload/access/anyone.ts` which simply returns `true`). There is no query constraint filtering by the `status` field for anonymous users.

---

## Step 1: Create `publishedOrAuthenticated` access function for custom status field

**Estimated Time:** 10 minutes

**Root Cause:** No reusable access function exists that filters by the custom `status` field (as opposed to `_status`).

**Files to Touch:**

- `src/server/payload/access/publishedOrAuthenticated.ts` (NEW)

**Exact Behavior:**

The function receives `{ req: { user } }` from Payload's access control system:
- If `user` is truthy → return `true` (authenticated users see all content: draft, published, archived)
- If `user` is falsy → return `{ status: { equals: 'published' } }` (anonymous users only see published)

This is identical to the existing `authenticatedOrPublished.ts` pattern but uses `status` instead of `_status`.

```typescript
import type { Access } from 'payload'

export const publishedOrAuthenticated: Access = ({ req: { user } }) => {
  if (user) return true
  return { status: { equals: 'published' } }
}
```

**Reproduction Test:** `tests/unit/access/publishedOrAuthenticated.test.ts` (NEW)

- Test 1: `publishedOrAuthenticated({ req: { user: { id: '1', role: 'admin' } } })` returns `true`
- Test 2: `publishedOrAuthenticated({ req: { user: { id: '2', role: 'student' } } })` returns `true`
- Test 3: `publishedOrAuthenticated({ req: { user: null } })` returns `{ status: { equals: 'published' } }`
- Test 4: `publishedOrAuthenticated({ req: { user: undefined } })` returns `{ status: { equals: 'published' } }`

**Why tests fail before fix:** The file doesn't exist yet, so import fails.

**Acceptance Criteria:**

- [x] `publishedOrAuthenticated` function exported from `src/server/payload/access/publishedOrAuthenticated.ts`
- [x] Returns `true` for any authenticated user
- [x] Returns `{ status: { equals: 'published' } }` for anonymous users
- [x] All 4 tests pass

---

## Step 2: Replace `read: anyone` with `read: publishedOrAuthenticated` in Courses, Chapters, and Lessons

**Estimated Time:** 10 minutes

**Root Cause:** `read: anyone` in all three collection configs allows anonymous users to see all content regardless of status.

**Files to Touch:**

- `src/server/payload/collections/Courses.ts` (MODIFIED — line 14, line 30)
- `src/server/payload/collections/Chapters.ts` (MODIFIED — line 4, line 20)
- `src/server/payload/collections/Lessons.ts` (MODIFIED — line 5, line 20)

**Exact Changes per File:**

### Courses.ts
- **Line 14:** Change `import { anyone } from '../access/anyone'` → `import { publishedOrAuthenticated } from '../access/publishedOrAuthenticated'`
- **Line 30:** Change `read: anyone,` → `read: publishedOrAuthenticated,`

### Chapters.ts
- **Line 4:** Change `import { anyone } from '../access/anyone'` → `import { publishedOrAuthenticated } from '../access/publishedOrAuthenticated'`
- **Line 20:** Change `read: anyone,` → `read: publishedOrAuthenticated,`

### Lessons.ts
- **Line 5:** Change `import { anyone } from '../access/anyone'` → `import { publishedOrAuthenticated } from '../access/publishedOrAuthenticated'`
- **Line 20:** Change `read: anyone,` → `read: publishedOrAuthenticated,`

**Reproduction Test:** `tests/unit/access/content-read-access.test.ts` (NEW)

This is the primary reproduction test that demonstrates the bug:

- Test 1 (Courses): `Courses.access.read` is NOT the `anyone` function — it should be `publishedOrAuthenticated`
- Test 2 (Chapters): `Chapters.access.read` is NOT the `anyone` function — it should be `publishedOrAuthenticated`
- Test 3 (Lessons): `Lessons.access.read` is NOT the `anyone` function — it should be `publishedOrAuthenticated`
- Test 4 (Courses behavior): Calling `Courses.access.read({ req: { user: null } })` returns query constraint `{ status: { equals: 'published' } }`, NOT `true`
- Test 5 (Chapters behavior): Calling `Chapters.access.read({ req: { user: null } })` returns query constraint `{ status: { equals: 'published' } }`, NOT `true`
- Test 6 (Lessons behavior): Calling `Lessons.access.read({ req: { user: null } })` returns query constraint `{ status: { equals: 'published' } }`, NOT `true`
- Test 7 (Courses authenticated): Calling `Courses.access.read({ req: { user: { id: '1' } } })` returns `true`
- Test 8 (Chapters authenticated): Calling `Chapters.access.read({ req: { user: { id: '1' } } })` returns `true`
- Test 9 (Lessons authenticated): Calling `Lessons.access.read({ req: { user: { id: '1' } } })` returns `true`

**Why tests fail before fix:** All three collections currently use `read: anyone` which always returns `true`. Tests checking for the query constraint will fail — they'll get `true` instead of `{ status: { equals: 'published' } }`.

**Acceptance Criteria:**

- [x] `Courses.access.read` is `publishedOrAuthenticated` (not `anyone`)
- [x] `Chapters.access.read` is `publishedOrAuthenticated` (not `anyone`)
- [x] `Lessons.access.read` is `publishedOrAuthenticated` (not `anyone`)
- [x] Anonymous API calls to `/api/courses` only return published courses
- [x] Anonymous API calls to `/api/chapters` only return published chapters
- [x] Anonymous API calls to `/api/lessons` only return published lessons
- [x] Authenticated API calls return all content (draft, published, archived)
- [x] All 9 tests pass

---

## Step 3: Update existing test that asserts `read: anyone`

**Estimated Time:** 5 minutes

**Root Cause:** The existing test file `tests/unit/access/content-collections-admin-only.test.ts` has assertions that `read` is `anyone` for Courses (line 38), Chapters (line 56), and Lessons (line 75). These will break after the fix and need updating.

**Files to Touch:**

- `tests/unit/access/content-collections-admin-only.test.ts` (MODIFIED — lines 37-39, 55-57, 74-76)

**Exact Changes:**

### Courses block (line 37-39)
Replace:
```typescript
it('should use anyone for read operation (unchanged)', () => {
  expect(Courses.access?.read).toBe(anyone)
})
```
With:
```typescript
it('should use publishedOrAuthenticated for read operation (status-filtered)', () => {
  expect(Courses.access?.read).toBe(publishedOrAuthenticated)
})
```

### Chapters block (line 55-57)
Replace:
```typescript
it('should use anyone for read operation (unchanged)', () => {
  expect(Chapters.access?.read).toBe(anyone)
})
```
With:
```typescript
it('should use publishedOrAuthenticated for read operation (status-filtered)', () => {
  expect(Chapters.access?.read).toBe(publishedOrAuthenticated)
})
```

### Lessons block (line 74-76)
Replace:
```typescript
it('should use anyone for read operation (unchanged)', () => {
  expect(Lessons.access?.read).toBe(anyone)
})
```
With:
```typescript
it('should use publishedOrAuthenticated for read operation (status-filtered)', () => {
  expect(Lessons.access?.read).toBe(publishedOrAuthenticated)
})
```

Also add import at the top:
```typescript
import { publishedOrAuthenticated } from '@/server/payload/access/publishedOrAuthenticated'
```

**Note:** The `anyone` import can be removed if no other tests in this file reference it (Categories, PricingPlans, and Media still use `anyone` for read — check lines 93, 110, 129). Keep the `anyone` import since those collections still use it.

**Verification:**

- Run `pnpm vitest run tests/unit/access/content-collections-admin-only.test.ts` → all tests pass
- The 3 updated assertions now correctly verify the new access function

**Acceptance Criteria:**

- [x] No existing tests broken by the fix
- [x] `content-collections-admin-only.test.ts` passes with updated assertions
- [x] Categories, PricingPlans, and Media tests unchanged (still `read: anyone`)

---

## Verification Commands

After all steps complete, run:

```bash
# Unit tests for the new access function
pnpm vitest run tests/unit/access/publishedOrAuthenticated.test.ts

# Unit tests for collection read access behavior
pnpm vitest run tests/unit/access/content-read-access.test.ts

# Updated existing tests
pnpm vitest run tests/unit/access/content-collections-admin-only.test.ts

# Type check
pnpm tsc --noEmit

# Full lint
pnpm lint
```

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/server/payload/access/publishedOrAuthenticated.ts` | NEW | Access function: authenticated → all, anonymous → published only |
| `src/server/payload/collections/Courses.ts` | MODIFIED (lines 14, 30) | Replace `anyone` import/usage with `publishedOrAuthenticated` |
| `src/server/payload/collections/Chapters.ts` | MODIFIED (lines 4, 20) | Replace `anyone` import/usage with `publishedOrAuthenticated` |
| `src/server/payload/collections/Lessons.ts` | MODIFIED (lines 5, 20) | Replace `anyone` import/usage with `publishedOrAuthenticated` |
| `tests/unit/access/publishedOrAuthenticated.test.ts` | NEW | Unit tests for the new access function |
| `tests/unit/access/content-read-access.test.ts` | NEW | Reproduction tests proving the bug is fixed |
| `tests/unit/access/content-collections-admin-only.test.ts` | MODIFIED (lines 37-39, 55-57, 74-76 + import) | Update assertions from `anyone` to `publishedOrAuthenticated` |

---

## Assumptions

1. The `anyone` import in Courses/Chapters/Lessons is ONLY used for `read` access — confirmed by reading the source files.
2. No other files import `anyone` specifically for these three collections' read access.
3. The custom `status` field (not `_status`) is the correct field to filter on — confirmed by spec and source code inspection.
4. Categories, PricingPlans, and Media collections intentionally remain with `read: anyone` — they are NOT part of this fix scope.

## Spec Requirement Traceability

| Requirement | Step | Test |
|-------------|------|------|
| FR-1: Anonymous users should only see published content | Steps 1-2 | `content-read-access.test.ts` Tests 4-6 |
| FR-2: Authenticated users should see all content | Steps 1-2 | `content-read-access.test.ts` Tests 7-9, `publishedOrAuthenticated.test.ts` Tests 1-2 |
| FR-3: Apply same pattern to courses, chapters, lessons | Step 2 | `content-read-access.test.ts` Tests 1-9 |
