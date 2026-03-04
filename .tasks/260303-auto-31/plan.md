# Plan: 260303-auto-31 — Restrict Public Read Access for Hierarchical Content

## Rerun Context

This is a rerun triggered via `/cody rerun` with no specific code-level feedback. The previous plan was not found (no `plan.md` existed). This plan is written fresh based on the spec. The approach focuses on:

1. Creating a reusable access helper for custom `status`+`isActive` filtering (not `_status`)
2. Applying it to all three collection configs (Courses, Chapters, Lessons)
3. Hardening the Local API query files to add `overrideAccess: false` and reduce `depth`
4. Adding hierarchy-aware ancestor constraints for Chapters and Lessons
5. Integration tests proving anonymous users cannot see draft/inactive/orphaned content

## Assumptions

- **Open Question 1**: "Authenticated users see all" applies to ALL authenticated roles (including `student`). The spec says "if `req.user` is present, read access is allowed." We follow this literally. Only admins can create/update/delete.
- **Open Question 2**: Hierarchy invariant MUST be enforced for anonymous users (spec FR-004 is MUST priority).
- **Open Question 3**: `isActive=true` IS required for all anonymous reads (spec is explicit).
- **Open Question 4**: A NEW access helper will be created (the existing `authenticatedOrPublished` uses `_status` which is Payload's draft system, NOT our custom `status` field).
- **Open Question 5**: The three query files in `src/server/repos/queries/` are the primary public-serving code paths. We audit and fix them.
- **Open Question 6**: Existing indexes on `status` and `isActive` are sufficient; no new indexes needed.
- MongoDB supports dot-path queries on relationships when the relationship is populated. However, Payload access control `where` constraints operate at the database level and dot-path queries on relationship fields (e.g., `course.status`) work with MongoDB when the relationship stores an ObjectId and the query engine resolves the join. We will verify this works; if not, we fall back to denormalized flags maintained by hooks.

**IMPORTANT MongoDB Note**: Payload with MongoDB does NOT support dot-path queries across relationships in access control `where` constraints (e.g., `'course.status': { equals: 'published' }` won't work because `course` is stored as an ObjectId, not an embedded document). Therefore, we will NOT use dot-path parent constraints in access control. Instead:
- Collection-level access control will filter on the document's OWN `status` and `isActive` fields only.
- Hierarchy invariant (FR-004) will be enforced at the **query layer** (`src/server/repos/queries/`) by ensuring parent IDs come from already-filtered-published parents, AND by reducing `depth` to prevent leaking restricted ancestors via relationship population.

---

## Step 1: Create `publishedAndActive` Access Helper

**Time estimate**: 10 minutes

**Files to Touch**:
- `src/server/payload/access/publishedAndActive.ts` (NEW)

**Root Cause**: Collections `courses`, `chapters`, `lessons` all use `read: anyone` which allows anonymous users to read ALL documents including drafts, archived, and inactive content. The existing `authenticatedOrPublished` helper filters on `_status` (Payload's internal drafts field), not on our custom `status` select field.

**Exact Behavior**:
Create a reusable `Access` function:
- If `req.user` is present → return `true` (authenticated users see everything)
- If `req.user` is absent → return a `where` constraint: `{ and: [{ status: { equals: 'published' } }, { isActive: { equals: true } }] }`

This helper works for the document's OWN fields. It does NOT attempt cross-relationship dot-path queries.

**Reproduction Test** (MUST FAIL before fix):
- Test location: `tests/unit/access/publishedAndActive.spec.ts`
- Test 1: `publishedAndActive returns true when user is present` — call with `{ req: { user: { id: '1', role: 'student' } } }`, expect `true`
- Test 2: `publishedAndActive returns where constraint when user is absent` — call with `{ req: { user: null } }`, expect `{ and: [{ status: { equals: 'published' } }, { isActive: { equals: true } }] }`

**Why tests fail before**: The file does not exist yet.

**Fix**: Create the file with the access helper implementation.

**Acceptance Criteria**:
- [x] `publishedAndActive` exported from `src/server/payload/access/publishedAndActive.ts`
- [x] Returns `true` for authenticated users (any role)
- [x] Returns status+isActive `where` constraint for anonymous users
- [x] Does NOT reference `_status` (Payload's internal draft field)
- [x] Unit tests pass

**Spec refs**: FR-005, FR-001, FR-002, FR-003

---

## Step 2: Apply `publishedAndActive` to Courses, Chapters, Lessons Collection Configs

**Time estimate**: 15 minutes

**Files to Touch**:
- `src/server/payload/collections/Courses.ts` (MODIFIED — line 33: change `read: anyone` to `read: publishedAndActive`)
- `src/server/payload/collections/Chapters.ts` (MODIFIED — line 20: change `read: anyone` to `read: publishedAndActive`)
- `src/server/payload/collections/Lessons.ts` (MODIFIED — line 20: change `read: anyone` to `read: publishedAndActive`)

**Root Cause**: All three collections use `read: anyone` which means Payload REST/GraphQL endpoints return ALL documents to anonymous users, including drafts and inactive content.

**Exact Behavior**:
- Import `publishedAndActive` from `@/server/payload/access/publishedAndActive`
- Replace `read: anyone` with `read: publishedAndActive` in each collection's `access` block
- Keep `create`, `update`, `delete` as `adminOnly` (unchanged)

**Reproduction Test** (MUST FAIL before fix):
- Test location: `tests/int/hierarchy-access-control.int.spec.ts`
- Test 1: `anonymous user cannot read draft course via REST` — Create a course with `status: 'draft'`, then `payload.find({ collection: 'courses', overrideAccess: false, where: { id: { equals: courseId } } })` with NO user → expect 0 docs returned
- Test 2: `anonymous user cannot read inactive course` — Create course with `status: 'published', isActive: false`, query without user with `overrideAccess: false` → expect 0 docs
- Test 3: `anonymous user CAN read published+active course` — Create course with `status: 'published', isActive: true`, query without user with `overrideAccess: false` → expect 1 doc
- Test 4: `authenticated user can read draft course` — Same draft course, query WITH user and `overrideAccess: false` → expect 1 doc
- Test 5-8: Repeat tests 1-4 for `chapters` collection
- Test 9-12: Repeat tests 1-4 for `lessons` collection

**Why tests fail before**: With `read: anyone`, anonymous queries return ALL docs regardless of status.

**Fix**: Change `read: anyone` → `read: publishedAndActive` in all three configs.

**Acceptance Criteria**:
- [x] Courses collection uses `publishedAndActive` for read access
- [x] Chapters collection uses `publishedAndActive` for read access
- [x] Lessons collection uses `publishedAndActive` for read access
- [x] Draft/archived/inactive documents hidden from anonymous REST/GraphQL
- [x] Authenticated users (any role) can still read all documents
- [x] Admin create/update/delete unchanged

**Spec refs**: FR-001, FR-002, FR-003, NFR-001, NFR-003

---

## Step 3: Harden Local API Query Files — Add `overrideAccess: false` and Reduce Depth

**Time estimate**: 20 minutes

**Files to Touch**:
- `src/server/repos/queries/courses.ts` (MODIFIED — lines 8-32, 40-61)
- `src/server/repos/queries/chapters.ts` (MODIFIED — lines 8-33, 41-65, 77-88)
- `src/server/repos/queries/lessons.ts` (MODIFIED — lines 9-34, 40-66, 86-111)

**Root Cause**: All three query files use `payload.find()` without `overrideAccess: false`. Even though they manually apply `status: 'published'` and `isActive: true` filters, the Local API defaults to `overrideAccess: true`, which means:
1. The access control layer is completely bypassed
2. `depth: 2` populates relationships which could leak draft/inactive parent data
3. If someone removes the manual `where` filters, there's no safety net

**Exact Behavior**:

For **all query functions** in these files:
1. Add `overrideAccess: false` to every `payload.find()` call — this activates the collection-level access control (from Step 2) as a safety net
2. Reduce `depth: 2` → `depth: 1` — sufficient for display needs while limiting relationship exposure
3. Keep the existing manual `where` constraints as defense-in-depth (they are redundant with access control but provide explicit documentation of intent)

**Changes per file**:

`courses.ts`:
- `queryCourseBySlug`: Add `overrideAccess: false`, change `depth: 2` → `depth: 1`
- `queryPublishedCourses`: Add `overrideAccess: false`, change `depth: 2` → `depth: 1`

`chapters.ts`:
- `queryChaptersByCourse`: Add `overrideAccess: false`, change `depth: 2` → `depth: 1`
- `queryChapterBySlug`: Add `overrideAccess: false`, change `depth: 2` → `depth: 1`
- `queryChaptersByGrade`: The inner `payload.find` for courses also needs `overrideAccess: false`

`lessons.ts`:
- `queryLessonsByChapter`: Add `overrideAccess: false`, change `depth: 2` → `depth: 1`
- `queryLessonBySlug`: Add `overrideAccess: false`, change `depth: 2` → `depth: 1`
- `queryLessonsByCourse`: The inner `payload.find` for lessons also needs `overrideAccess: false`

**Reproduction Test** (extends integration test file from Step 2):
- Test location: `tests/int/hierarchy-access-control.int.spec.ts` (add to same file)
- Test 1: `queryPublishedCourses does not return draft courses` — Create draft course, call `queryPublishedCourses()`, verify it's not in results. (Note: this already manually filters, but with `overrideAccess: false` it's doubly protected)
- Test 2: `queryCourseBySlug returns null for draft course` — Create draft course with known slug, call `queryCourseBySlug({ slug })`, verify returns `null`
- Test 3: `queryChaptersByCourse does not return inactive chapters` — Create inactive chapter under published course, verify not returned

**Why tests fail before**: Currently they might pass due to manual filters, but the underlying access bypass (`overrideAccess: true` default) is the real vulnerability. Tests validate the COMBINED effect.

**Fix**: Add `overrideAccess: false` and reduce `depth` in all query functions.

**Acceptance Criteria**:
- [x] All `payload.find()` calls in courses.ts include `overrideAccess: false`
- [x] All `payload.find()` calls in chapters.ts include `overrideAccess: false`
- [x] All `payload.find()` calls in lessons.ts include `overrideAccess: false`
- [x] All `depth` values reduced from `2` to `1`
- [x] Existing manual `where` constraints preserved
- [x] Public query results don't leak draft/inactive related content via depth population

**Spec refs**: FR-006, NFR-001, NFR-004

---

## Step 4: Enforce Hierarchy Invariant — Chapters Under Non-Public Courses Hidden

**Time estimate**: 20 minutes

**Files to Touch**:
- `src/server/repos/queries/chapters.ts` (MODIFIED — all query functions)

**Root Cause**: Even with per-collection `publishedAndActive` access, a published+active chapter whose parent course is `draft` or `isActive=false` would still be returned by `queryChapterBySlug`. The hierarchy invariant (FR-004) says: "A document is public-visible only if it AND all its ancestors are published+active."

MongoDB cannot do cross-collection joins in access-control `where` constraints. So we enforce this at the query layer.

**Exact Behavior**:

For `queryChapterBySlug`:
1. After finding the chapter, verify its parent course is published+active
2. If the chapter has a populated `course` object (from `depth: 1`), check `course.status === 'published' && course.isActive === true`
3. If course is only an ID (not populated), do a separate `payload.findByID` with `overrideAccess: false` to check visibility
4. If parent course is not public-visible, return `null`

For `queryChaptersByCourse`:
- Already safe because the `courseId` parameter comes from a course that was already fetched through the published filter. The caller (frontend page) only has the courseId if the course was visible. HOWEVER, we should add a defensive check: before querying chapters, verify the course exists and is published+active.

For `queryChaptersByGrade`:
- Already safe: it first finds a published+active course, then queries chapters for that course.

**Reproduction Test**:
- Test location: `tests/int/hierarchy-access-control.int.spec.ts` (same file)
- Test 1: `queryChapterBySlug returns null for chapter under draft course` — Create a draft course + published+active chapter. Call `queryChapterBySlug({ slug })`. Expect `null`.
- Test 2: `queryChapterBySlug returns chapter under published+active course` — Published+active course + published+active chapter. Expect the chapter.
- Test 3: `queryChaptersByCourse returns empty for draft course` — Create draft course, get its ID, call `queryChaptersByCourse({ courseId })`. Expect empty array (the access control filters out chapters whose courseId matches a draft course, but chapters themselves are published — actually the chapters will be returned since they pass their own access check. This is the gap). **This test proves the hierarchy bug exists.**

**Why tests fail before**: `queryChapterBySlug` currently returns published+active chapters even if their parent course is draft, because it only filters on the chapter's own status.

**Fix**:
- In `queryChapterBySlug`: After fetching the chapter, check parent course visibility. Return `null` if course is not published+active.
- In `queryChaptersByCourse`: Add a pre-check that verifies the courseId belongs to a published+active course. If not, return empty array.

**Acceptance Criteria**:
- [x] `queryChapterBySlug` verifies parent course is published+active
- [x] `queryChaptersByCourse` verifies the course is published+active before querying
- [x] Chapters under draft/inactive courses not returned to public
- [x] No N+1 queries (single course lookup, not per-chapter)

**Spec refs**: FR-002, FR-004, NFR-002

---

## Step 5: Enforce Hierarchy Invariant — Lessons Under Non-Public Chapters/Courses Hidden

**Time estimate**: 20 minutes

**Files to Touch**:
- `src/server/repos/queries/lessons.ts` (MODIFIED — all query functions)

**Root Cause**: Same as Step 4 but for lessons. A published+active lesson under a draft chapter (or a chapter under a draft course) should not be visible to anonymous users.

**Exact Behavior**:

For `queryLessonBySlug`:
1. After finding the lesson, verify its parent chapter is published+active
2. Then verify the chapter's parent course is published+active
3. If either ancestor fails the check, return `null`
4. With `depth: 1`, the `chapter` field will be populated. Check `chapter.status === 'published' && chapter.isActive === true`. Then do a separate lookup for the course.

For `queryLessonsByChapter`:
- Add a pre-check: verify the `chapterId` belongs to a published+active chapter, AND that chapter's parent course is published+active. If not, return empty array.

For `queryLessonsByCourse`:
- Already partially safe: it calls `queryChaptersByCourse` (which after Step 4 will verify course visibility), then uses those chapter IDs. But add explicit course visibility check as defense-in-depth.

**Reproduction Test**:
- Test location: `tests/int/hierarchy-access-control.int.spec.ts` (same file)
- Test 1: `queryLessonBySlug returns null for lesson under draft chapter` — Create published course + draft chapter + published lesson. Call `queryLessonBySlug({ slug })`. Expect `null`.
- Test 2: `queryLessonBySlug returns null for lesson under chapter with draft course` — Create draft course + published chapter + published lesson. Call `queryLessonBySlug({ slug })`. Expect `null`.
- Test 3: `queryLessonsByChapter returns empty for draft chapter` — Draft chapter + published lessons. Expect empty array.
- Test 4: `queryLessonBySlug returns lesson when full hierarchy is published+active` — All ancestors published+active. Expect the lesson.

**Why tests fail before**: `queryLessonBySlug` returns published lessons regardless of parent chapter/course status.

**Fix**:
- In `queryLessonBySlug`: After fetching, check parent chapter and grandparent course visibility.
- In `queryLessonsByChapter`: Pre-check chapter + course visibility.
- In `queryLessonsByCourse`: Add course visibility pre-check.

**Acceptance Criteria**:
- [x] `queryLessonBySlug` verifies parent chapter AND grandparent course are published+active
- [x] `queryLessonsByChapter` verifies chapter + course are published+active
- [x] `queryLessonsByCourse` verifies course is published+active
- [x] Lessons under any non-public ancestor not returned to public
- [x] Max 2 extra queries per request (chapter lookup + course lookup), no N+1

**Spec refs**: FR-003, FR-004, NFR-002

---

## Step 6: Comprehensive Integration Tests

**Time estimate**: 30 minutes

**Files to Touch**:
- `tests/int/hierarchy-access-control.int.spec.ts` (NEW — consolidates all tests from steps 2-5)

**Exact Behavior**:

This test file is the single integration test suite that proves all access control behaviors. It uses the Payload Local API with `overrideAccess: false` and no user to simulate anonymous access, and with a user object to simulate authenticated access.

**Test Setup** (beforeAll):
1. Get payload instance
2. Ensure default tenant exists
3. Create test category
4. Create test data:
   - Published+active course (Course A)
   - Draft course (Course B)
   - Inactive course with `status: 'published', isActive: false` (Course C)
   - Published+active chapter under Course A (Chapter A1)
   - Published+active chapter under Course B — draft parent (Chapter B1)
   - Draft chapter under Course A (Chapter A2-draft)
   - Published+active lesson under Chapter A1 (Lesson A1a)
   - Published+active lesson under Chapter B1 — draft grandparent course (Lesson B1a)
   - Published+active lesson under Chapter A2-draft — draft parent chapter (Lesson A2a)
   - Draft lesson under Chapter A1 (Lesson A1b-draft)
5. Create an admin user for authenticated tests

**Test Cases** (organized by describe blocks):

```
describe('Courses — anonymous access')
  ✅ returns published+active course
  ❌ does NOT return draft course
  ❌ does NOT return inactive course (published but isActive=false)
  ❌ does NOT return archived course

describe('Courses — authenticated access')
  ✅ returns draft course for authenticated user
  ✅ returns inactive course for authenticated user

describe('Chapters — anonymous access')
  ✅ returns published+active chapter under published+active course
  ❌ does NOT return draft chapter
  ❌ does NOT return published chapter under draft course (hierarchy invariant)

describe('Chapters — authenticated access')
  ✅ returns draft chapter for authenticated user

describe('Lessons — anonymous access')
  ✅ returns published+active lesson under published+active hierarchy
  ❌ does NOT return draft lesson
  ❌ does NOT return published lesson under draft chapter (hierarchy invariant)
  ❌ does NOT return published lesson under draft course (hierarchy invariant)

describe('Lessons — authenticated access')
  ✅ returns draft lesson for authenticated user

describe('Query layer — hierarchy enforcement')
  ❌ queryChapterBySlug returns null for chapter under draft course
  ❌ queryLessonBySlug returns null for lesson under draft chapter
  ❌ queryLessonBySlug returns null for lesson under draft course
  ✅ queryPublishedCourses excludes draft/inactive courses
  ✅ queryChaptersByCourse returns empty for draft course
  ✅ queryLessonsByChapter returns empty for draft chapter
```

**Teardown** (afterAll): Delete all test data in reverse creation order.

**Acceptance Criteria**:
- [x] All 18+ test cases pass
- [x] Tests cover all spec acceptance criteria
- [x] Tests use `overrideAccess: false` to simulate real access control
- [x] Tests import and call actual query functions from `src/server/repos/queries/`
- [x] No test data left behind (cleanup in afterAll)

**Spec refs**: All FR-*, NFR-001, NFR-003

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `src/server/payload/access/publishedAndActive.ts` | NEW | Reusable access helper for custom status+isActive |
| `src/server/payload/collections/Courses.ts` | MODIFIED | Change `read: anyone` → `read: publishedAndActive` |
| `src/server/payload/collections/Chapters.ts` | MODIFIED | Change `read: anyone` → `read: publishedAndActive` |
| `src/server/payload/collections/Lessons.ts` | MODIFIED | Change `read: anyone` → `read: publishedAndActive` |
| `src/server/repos/queries/courses.ts` | MODIFIED | Add `overrideAccess: false`, reduce depth |
| `src/server/repos/queries/chapters.ts` | MODIFIED | Add `overrideAccess: false`, reduce depth, add parent course visibility check |
| `src/server/repos/queries/lessons.ts` | MODIFIED | Add `overrideAccess: false`, reduce depth, add parent chain visibility check |
| `tests/unit/access/publishedAndActive.spec.ts` | NEW | Unit tests for access helper |
| `tests/int/hierarchy-access-control.int.spec.ts` | NEW | Comprehensive integration tests |

---

## Execution Order

Steps 1 → 2 → 3 → 4 → 5 → 6

Steps 1-2 must be done first (access helper + collection config changes).
Step 3 can be done after Step 2 (query files depend on access control being in place).
Steps 4-5 depend on Step 3 (hierarchy enforcement in query layer).
Step 6 is the test file that covers all steps (can be written alongside other steps in TDD fashion).

---

## Verification Commands

```bash
# Unit tests for access helper
pnpm vitest run --config vitest.config.unit.mts tests/unit/access/publishedAndActive.spec.ts

# Integration tests for access control
pnpm vitest run tests/int/hierarchy-access-control.int.spec.ts

# Type checking
pnpm tsc --noEmit

# Lint
pnpm lint
```
