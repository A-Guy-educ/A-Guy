# Bug Fix Plan: Draft Content Publicly Readable via API

## Rerun Context

This is a rerun of a previous attempt. Feedback: "Rerun requested via /cody rerun" — no specific issues provided. The plan follows the bug fix TDD pattern as required.

---

## Bug Summary

**Root Cause**: The `courses`, `chapters`, and `lessons` collections use `read: anyone` without filtering by the custom `status` field. This allows anonymous users to access draft and archived content via the API.

**Security Impact**: HIGH — Data leak, unpublished content visible to public

---

## Step 1: Fix Courses Collection Access Control

**Files to Touch**:

- `src/server/payload/collections/Courses.ts` (MODIFIED - line 30)
- `tests/unit/access/content-collections-admin-only.test.ts` (MODIFIED - remove old read:anyone tests)

**Reproduction Test**:

- Test location: `tests/unit/access/content-collections-admin-only.test.ts` (EXISTING - update)
- What it tests: Anonymous user (no `req.user`) should only see published courses
- Why it fails now: `read: anyone` allows access to all courses regardless of status

**Fix**: Replace `read: anyone` with status-aware access function:

```typescript
read: ({ req: { user } }) => {
  if (user) return true // Authenticated users see all
  return { status: { equals: 'published' } } // Anonymous see only published
}
```

**Verification**:
- Run test → FAILS (currently returns all courses)
- After fix → PASSES (returns only published courses for anonymous users)

---

## Step 2: Fix Chapters Collection Access Control

**Files to Touch**:

- `src/server/payload/collections/Chapters.ts` (MODIFIED - line 20)

**Reproduction Test**:

- Test location: `tests/unit/access/content-collections-admin-only.test.ts` (EXISTING - update)
- What it tests: Anonymous user should only see published chapters

**Fix**: Replace `read: anyone` with same status-aware access function

**Verification**:
- Run test → FAILS
- After fix → PASSES

---

## Step 3: Fix Lessons Collection Access Control

**Files to Touch**:

- `src/server/payload/collections/Lessons.ts` (MODIFIED - line 20)

**Reproduction Test**:

- Test location: `tests/unit/access/content-collections-admin-only.test.ts` (EXISTING - update)
- What it tests: Anonymous user should only see published lessons

**Fix**: Replace `read: anyone` with same status-aware access function

**Verification**:
- Run test → FAILS
- After fix → PASSES

---

## Step 4: TypeScript Validation

**Command**: `pnpm tsc --noEmit`

**Purpose**: Ensure all TypeScript types compile correctly after the access control changes.

---

## Acceptance Criteria Checklist

- [ ] Fix applied to Courses.ts (line 30)
- [ ] Fix applied to Chapters.ts (line 20)
- [ ] Fix applied to Lessons.ts (line 20)
- [ ] Updated existing test file to verify new read access behavior (not anyone)
- [ ] Anonymous users can only see published content via API
- [ ] Authenticated users can still see all content (draft/published/archived)
- [ ] TypeScript compilation passes
- [ ] Unit tests pass
