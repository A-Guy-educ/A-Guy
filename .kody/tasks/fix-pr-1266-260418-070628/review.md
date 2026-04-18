I now have a complete picture of the PR. Here is the structured review.

---

## Verdict: PASS

## Summary

PR #1266 implements the Instructor role and per-course permissions for the LMS. The primary change is a clarifying comment in `CourseInstructors.ts` (lines 98–99) explaining why `AdvancedContentEditor` is intentionally excluded from read access — resolving the sole open item from the previous Kody review. Supporting infrastructure includes the `CourseInstructors` collection, `instructorAccess.ts` helpers, and the `/api/instructor/gradebook/[courseId]` endpoint.

## Findings

### Critical
None.

### Major
None.

### Minor
None — the previously flagged minor item (missing design-rationale comment) is now resolved at `CourseInstructors.ts:98–99`.

---

## Two-Pass Review

**Pass 1 — CRITICAL:**

### SQL & Data Safety
All queries use Payload's parameterized `where` clauses (`equals`, `in` operators). No string interpolation in queries. The gradebook route uses `enrolledUsers.docs.map((u) => u.id)` in an `in` clause — safe. ✅

### Race Conditions & Concurrency
`isInstructorForCourse`, `canInstructorGrade`, and `canInstructorMessageStudents` all use `limit: 1` queries — acceptable for permission checks. `CourseInstructors` create/update/delete are `adminOnly` so concurrent writes are not a user-facing concern. ✅

### LLM Output Trust Boundary
No LLM output in this PR. ✅

### Shell Injection
None. ✅

### Enum & Value Completeness
`AccountRole` has four values. All consumers are covered:

| Value | Access control | Status |
|---|---|---|
| `Admin` | Admin-only writes to `CourseInstructors` | ✅ `CourseInstructors.ts:89`, `adminOrContentEditor.ts:17`, `Exercises/index.ts:26` |
| `AdvancedContentEditor` | Exercise-level access only — excluded from `CourseInstructors` | ✅ `adminOrContentEditor.ts:17`, `Exercises/index.ts:26` — intentionally excluded per comment at `CourseInstructors.ts:98–99` |
| `Student` | No elevated access | ✅ No access control switches |
| `Instructor` | Per-course assignment via `CourseInstructors` | ✅ `CourseInstructors.ts:91`, `instructorAccess.ts:27` |

No missing `case` branches, allowlist gaps, or unsatisfied role checks. ✅

---

**Pass 2 — INFORMATIONAL:**

### Conditional Side Effects
The gradebook route implements a correct two-phase authorization: (1) `isAdmin()` role check at the route level, then (2) `isInstructorForCourse` + `canInstructorGrade` per-course assignment checks. Each branch correctly gates data access — no branch silently skips an authorization step. ✅

### Test Gaps
25/25 unit tests pass. `instructorAccess.ts` functions are fully unit-tested with mocks covering all branches including empty/null guards. `CourseInstructors` access control is implicitly covered by integration/admin tests. The gradebook route itself (`/api/instructor/gradebook/[courseId]`) has no integration test — this is a minor gap but not blocking since the route delegates to tested helpers and the critical `overrideAccess: true` pattern is consistent throughout the codebase.

### Dead Code & Consistency
`instructorAccess.ts:26–28` exports `isInstructor(user)` which is never called anywhere in the codebase (the gradebook route uses `user.role === AccountRole.Instructor` directly). This is harmless — it serves as a documented utility — but is technically dead import code if it were ever removed. Not flagged as it doesn't affect correctness.

The `AdvancedContentEditor` exclusion in `CourseInstructors` is consistent with its role scope elsewhere (`adminOrContentEditor` = exercise management, not course management). ✅

### Design System Compliance
No frontend files changed. ✅

### Performance & Bundle Impact
No new dependencies. The `fetchGradebookData` function makes two sequential DB queries (enrolled users → user progress) — acceptable for a bounded `limit: 100` gradebook call. No runtime performance concerns. ✅

### Type Coercion at Boundaries
`gradebook/route.ts:131` — `(typeof userProgress.docs)[0]['progressRecords']` correctly resolves the array-index type. Lines 134–136 handle relationship field polymorphism (`typeof user === 'object'` guard) before extracting the ID. ✅

---

**Verification:**
- `src/server/payload/collections/CourseInstructors.ts:98–99` — clarifying comment present ✅
- `src/infra/auth/roles.ts` — `AccountRole` enum has 4 values, all accounted for ✅
- `src/app/api/instructor/gradebook/[courseId]/route.ts` — two-phase authorization pattern sound, type fix at line 131 correct ✅
- `src/server/payload/hooks/auth/instructorAccess.ts` — all functions use `overrideAccess: true` appropriately (authorization enforced at calling route level) ✅
- `tests/unit/hooks/instructorAccess/instructorAccess.test.ts` — 25/25 tests covering all exported functions ✅
- Browser verification not applicable — no frontend/UI changes in this PR ✅