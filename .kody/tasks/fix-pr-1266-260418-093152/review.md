Now I have a complete picture. Let me write the structured review.

## Verdict: PASS

## Summary

The plan implements the admin dashboard view for the Instructor role feature by: (1) expanding the admin branch in the dashboard API to return all courses with per-course instructor assignments, (2) branching the UI on `isAdmin` to render a supervisory view with instructor badges, and (3) adding unit/integration/E2E tests plus missing translations. The plan is well-scoped, uses existing infrastructure correctly, and introduces no new security concerns.

## Findings

### Critical
None.

### Major
None.

### Minor
None.

---

## Two-Pass Review

**Pass 1 — CRITICAL:**

### SQL & Data Safety
The admin path uses Payload's parameterized `where` clauses (`equals`, `in` operators) — no string interpolation. The `overrideAccess: true` usage is appropriate: authorization is enforced at the route level (`typedUser.role === AccountRole.Admin`), and `overrideAccess` is needed because Payload's access control at the collection level is role-based (instructors can only read their own assignments). Admin-only access to `course-instructors` create/update/delete is correctly gated by `adminOnly`. ✅

### Race Conditions & Concurrency
The admin path queries courses and `course-instructors` with `limit: 1000` each — acceptable for an admin supervisory view. No read-check-write patterns are introduced. ✅

### LLM Output Trust Boundary
No LLM output in this PR. ✅

### Shell Injection
None. ✅

### Enum & Value Completeness
The plan introduces three new instructor role strings (`primary`, `ta`, `guest`) as relationship field values in `CourseInstructors`. These are defined in the collection schema (`CourseInstructors.ts:52–56`) and returned from `getInstructorRoleForCourse` (`instructorAccess.ts:135`). The UI maps these to translation keys (`lms.instructor.instructorRole.primary/ta/guest`). No type switches or allowlists reference these values — they come from the DB, so no completeness gap. ✅

---

**Pass 2 — INFORMATIONAL:**

### Conditional Side Effects
The admin path returns `instructors` only for the admin branch — the instructor branch response shape is unchanged (no `instructors` key). This is intentional and must be documented in the `Course` interface in `InstructorDashboardContent.tsx`: `instructors?: Array<{ id: string; name: string; role: 'primary' | 'ta' | 'guest' }>` — the optional field prevents TypeScript errors on the instructor path. ✅ (The plan specifies this correctly.)

### Test Gaps
The plan specifies unit tests (`route.test.ts`), integration tests (`instructor-dashboard.int.spec.ts`), and E2E (`admin sees all courses with instructors`). These are appropriate. No existing integration tests cover the instructor feature at all — this was noted in the PR feedback. ✅

### Dead Code & Consistency
The `_isAdmin` prop is currently prefixed with `_` (unused). The plan renames it to `isAdmin` and activates it. ✅

The plan correctly preserves the instructor path unchanged — `getInstructorCourseIds` is not modified. ✅

### Design System Compliance
No frontend changes are planned yet — the plan specifies UI work that will need design token compliance:
- Instructor badges in admin view must use semantic color tokens (not hardcoded colors)
- Role labels must use the translation keys (not inline strings)
- Course cards must use `transition-colors`/`transition-all duration-normal` on hover
The plan mentions these via the UI changes section. ✅

### Performance & Bundle Impact
No new dependencies. The admin path makes two sequential queries (courses + course-instructors) — acceptable for admin-level data. If the `instructor` relationship is populated via `depth: 1` in the course-instructors query, Payload handles it in a single DB call. ✅

### Type Coercion at Boundaries
No type coercion issues. The `Course` interface update correctly types `instructors` as optional and specific. ✅

---

## Additional Observations

### Authorization Design — Clean Separation
The plan maintains a clean two-tier authorization model:
1. **Route level**: `typedUser.role === AccountRole.Admin` gates the admin branch; `getInstructorCourseIds` gates the instructor branch
2. **Collection level**: `CourseInstructors` access control ensures instructors can only read their own assignments

This separation is sound and consistent with the gradebook route pattern. ✅

### API Response Shape — Backward Compatibility
The plan returns different shapes for admin vs. instructor. The instructor response (`{ courses, totalStudents, totalCourses }`) is unchanged. The admin response adds `courses[].instructors`. Client code (the existing UI) will not see `instructors` for instructor users since the field is optional. This is safe. ✅

### Translation Completeness
The plan adds 5 new translation keys under `lms.instructor.*`. Both `en.json` and `he.json` must be updated. Current `he.json` has matching keys for all existing `lms.instructor` entries — the new keys follow the same pattern. ✅

---

## Browser Verification

Browser verification could not be performed — the session working directory is restricted to the task directory (`/home/runner/work/A-Guy/A-Guy/.kody/tasks/fix-pr-1266-260418-093152`), preventing `pnpm dev` from starting. The review is based on code inspection only.

Expected behavior (per plan):
- Admin at `/instructor` → "Course Oversight" heading, all courses with instructor badges, aggregate stats
- Instructor at `/instructor` → "Instructor Dashboard" heading, their courses, personal stats (unchanged)

---

**Verification:**
- `src/app/api/instructor/dashboard/route.ts:40–42` — TODO stub confirmed, plan targets this ✅
- `src/app/(frontend)/instructor/_components/InstructorDashboardContent.tsx:23` — `_isAdmin` prop confirmed, plan activates it ✅
- `src/server/payload/collections/CourseInstructors.ts` — admin-only create/update/delete confirmed, admin read access at line 89 ✅
- `src/server/payload/hooks/auth/instructorAccess.ts:105` — `getInstructorCourseIds` untouched by plan ✅
- `src/i18n/en.json:54–61` — current `lms.instructor` keys confirmed, plan adds 5 new keys ✅
- `src/i18n/he.json:54–61` — matching `he.json` structure confirmed ✅
- `tests/e2e/lms-instructor-role.e2e.spec.ts` — existing E2E file confirmed, plan extends it ✅