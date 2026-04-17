
Now I have a complete picture of the PR. Let me write the final review.

---

## Verdict: PASS

## Summary

PR #1266 implements the Instructor role + per-course permissions feature for the LMS. The fix branch adds a clarifying comment to `CourseInstructors.ts` explaining why `AdvancedContentEditor` is intentionally excluded from read access — this was the sole open item from the Kody review. The comment is present and correctly explains the design rationale.

## Findings

### Critical
None.

### Major
None.

### Minor
None — the previously flagged minor item has been resolved.

---

## Two-Pass Review

**Pass 1 — CRITICAL:**

### SQL & Data Safety
No SQL injection risk. All queries use Payload's parameterized `where` clauses (`equals`, `in` operators) — no string interpolation. ✅

### Race Conditions & Concurrency
No find-or-create patterns. The `isInstructorForCourse` and `canInstructorGrade` functions use `limit: 1` queries — acceptable for permission checks. The `CourseInstructors` collection's unique constraint on `(instructor, course)` pairs (enforced by Payload's relationship fields) prevents duplicate assignments. ✅

### LLM Output Trust Boundary
No LLM output in this PR. ✅

### Shell Injection
None. ✅

### Enum & Value Completeness
`AccountRole` has four values: `Admin`, `AdvancedContentEditor`, `Student`, `Instructor`. All consumers are accounted for:

| Value | Access control | Usage |
|---|---|---|
| `Admin` | ✅ Admin-only collections (create/update/delete CourseInstructors) | `CourseInstructors.ts:89`, `adminOrContentEditor.ts:17`, `Exercises/index.ts:26` |
| `AdvancedContentEditor` | ✅ Exercise-level access (not course management) | `adminOrContentEditor.ts:17`, `Exercises/index.ts:26` — intentionally excluded from `CourseInstructors` (lines 98–99) |
| `Student` | ✅ Standard enrollment-based access | No access control switches |
| `Instructor` | ✅ Per-course assignment via `CourseInstructors` | `CourseInstructors.ts:91`, `instructorAccess.ts:27` |

No missing `case` branches or allowlist gaps. ✅

---

**Pass 2 — INFORMATIONAL:**

### Conditional Side Effects
The gradebook route has a well-structured two-phase authorization: (1) route-level role check via `isAdmin()`, then (2) per-course assignment check via `isInstructorForCourse` + `canInstructorGrade`. The conditional branching is correct — no branch skips a side effect. ✅

### Test Gaps
The task context confirms 25/25 unit tests pass. The `instructorAccess.ts` functions are unit-tested. The `CourseInstructors` access control is implicitly covered by integration/admin tests. ✅

### Dead Code & Consistency
No dead code. The `AdvancedContentEditor` exclusion in `CourseInstructors` is consistent with its role elsewhere (`adminOrContentEditor` scope = exercise management, not course management). ✅

### Design System Compliance
No frontend files changed in this PR. ✅

### Performance & Bundle Impact
No new dependencies. No runtime performance changes. ✅

### Type Coercion at Boundaries
`gradebook/route.ts:131` — `(typeof userProgress.docs)[0]['progressRecords']` correctly resolves the TypeScript array-index type ambiguity. No runtime coercion issues. ✅

---

**Verification:**
- Read `src/server/payload/collections/CourseInstructors.ts` — comment at lines 98–99 confirms the fix: *"AdvancedContentEditor is intentionally excluded — they are exercise editors, not course managers, and do not need to view instructor assignments."*
- Read `src/infra/auth/roles.ts` — `AccountRole` enum has 4 values, all handled appropriately across the codebase
- Read `src/app/api/instructor/gradebook/[courseId]/route.ts` — type fix at line 131, two-phase authorization pattern is sound
- Read `src/server/payload/hooks/auth/instructorAccess.ts` — `isInstructorForCourse`, `canInstructorGrade`, `canInstructorMessageStudents` all use `overrideAccess: true` appropriately (authorization is enforced at the calling route level)

The PR is ready to merge. The minor issue flagged by Kody is resolved, and no new issues were found.