# Bug Fix Plan: Draft Content Publicly Readable via API

## Rerun Context

This is a rerun after initial feedback. The original issue identified that `courses`, `chapters`, and `lessons` collections expose draft content to anonymous users via `read: anyone`. This plan implements the fix as specified in the spec.

## Bug Summary

**Root Cause**: The `courses`, `chapters`, and `lessons` collections use `read: anyone` (which returns `true` for everyone) without filtering by the `status` field. This allows anonymous API consumers to see draft and archived content.

**Security Impact**: HIGH — Data leak exposing unpublished content to the public.

---

## Step 1: Fix Courses Collection Read Access

**Files to Touch**:

- `src/server/payload/collections/Courses.ts` (MODIFIED - line 30)

**Reproduction Test**: Write an integration test that demonstrates the bug:

- Test location: `tests/int/courses-access.spec.ts`
- What it tests: Anonymous user queries courses API and should NOT receive draft/archived courses
- Why it fails currently: `read: anyone` allows all users (including anonymous) to read all content

```typescript
it('should NOT return draft courses to anonymous users', async () => {
  // Create a draft course
  await payload.create({ collection: 'courses', data: { title: 'Draft Course', status: 'draft' } })
  
  // Query as anonymous (no user)
  const result = await payload.find({ collection: 'courses', overrideAccess: false })
  
  // Should NOT include draft courses
  expect(result.docs.some(c => c.status === 'draft')).toBe(false)
})
```

**Fix**: Replace `read: anyone` with inline status-aware function:

```typescript
read: ({ req: { user } }) => {
  if (user) return true // Authenticated users see all
  return { status: { equals: 'published' } } // Anonymous see only published
},
```

**Verification**:
- Run reproduction test → FAILS before fix (drafts visible)
- After fix applied → PASSES (drafts hidden from anonymous)

---

## Step 2: Fix Chapters Collection Read Access

**Files to Touch**:

- `src/server/payload/collections/Chapters.ts` (MODIFIED - line 20)

**Reproduction Test**:

- Test location: `tests/int/chapters-access.spec.ts`
- What it tests: Anonymous user queries chapters API and should NOT receive draft/archived chapters

**Fix**: Same pattern as Step 1 - replace `read: anyone` with:

```typescript
read: ({ req: { user } }) => {
  if (user) return true
  return { status: { equals: 'published' } }
},
```

**Verification**:
- Run reproduction test → FAILS before fix
- After fix applied → PASSES

---

## Step 3: Fix Lessons Collection Read Access

**Files to Touch**:

- `src/server/payload/collections/Lessons.ts` (MODIFIED - line 20)

**Reproduction Test**:

- Test location: `tests/int/lessons-access.spec.ts`
- What it tests: Anonymous user queries lessons API and should NOT receive draft/archived lessons

**Fix**: Same pattern as Step 1 - replace `read: anyone` with:

```typescript
read: ({ req: { user } }) => {
  if (user) return true
  return { status: { equals: 'published' } }
},
```

**Verification**:
- Run reproduction test → FAILS before fix
- After fix applied → PASSES

---

## Step 4: TypeScript Validation

**Files to Touch**: None (validation only)

**Command**: Run TypeScript compilation to verify no type errors

```bash
pnpm tsc --noEmit
```

**Verification**:
- All three collection files should compile without errors
- No type errors related to the access function changes

---

## Acceptance Criteria Checklist

- [ ] Courses collection: `read` access fixed to filter by status for anonymous users
- [ ] Chapters collection: `read` access fixed to filter by status for anonymous users
- [ ] Lessons collection: `read` access fixed to filter by status for anonymous users
- [ ] TypeScript compilation passes
- [ ] Integration tests pass (anonymous users cannot see draft content)

---

## Notes

- This fix follows the inline function approach explicitly required in the spec (not using `authenticatedOrPublished` from Pages/Posts collections, which uses `_status` field)
- The `status` field in these collections is a custom select field (`draft | published | archived`), not Payload's built-in `_status`
- Authenticated users (with valid JWT) will still see all content - this is intentional for admin/editor workflow
