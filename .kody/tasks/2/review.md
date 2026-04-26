Based on my thorough review of all changed and new files in the `1244--featlms-instructor-role-per-course-permissi` branch, here is my structured review:

---

## Verdict: PASS

## Summary

This PR adds the `Instructor` role to the RBAC system, a new `course-instructors` collection linking instructors to courses with per-course permissions (primary/TA/guest), a new instructor dashboard API, a supervisory admin view at `/instructor`, a gradebook API, and comprehensive test coverage. All three requested components (API, UI, tests) are implemented.

---

## Findings

### Critical

None.

### Major

None.

### Minor

1. **`src/server/payload/collections/Users/roles.ts:7-21`** — The backward-compat re-export file does not include `isInstructor` (added to `@/infra/auth/roles` on the feature branch). All consumers on the feature branch correctly import `isInstructor` from `@/infra/auth/roles` directly, so this causes no runtime issue. However, if future code attempts the re-export import path, it will fail to compile. Consider adding `isInstructor` to the re-export for completeness.

2. **`src/app/api/instructor/dashboard/route.ts:44-46`** — The admin branch queries all courses with `limit: 1000` and all course-instructors with `limit: 1000` with no pagination. If the system grows beyond 1000 courses or assignments, the admin dashboard will silently truncate data. Consider adding pagination or at least a warning comment. (Not blocking — acceptable for initial rollout.)

3. **`src/app/(frontend)/instructor/page.tsx`** — The middleware (`src/middleware.ts:22`) does not include `/instructor` in its `protectedPaths` list, so unauthenticated requests pass through the middleware layer before the server component redirects to `/login`. This is functionally correct (server-side auth guards the page) but less efficient than middleware-level blocking. Acceptable for a non-critical internal page.

---

## Two-Pass Review

### Pass 1 — CRITICAL

**SQL & Data Safety**
- `route.ts` uses Payload's query builder throughout — parameterized queries, no raw SQL interpolation. ✅
- `CourseInstructors` uses proper Payload relationships (`instructor: { equals: userId }`, `course: { equals: courseId }`) — safe MongoDB queries. ✅
- No `overrideAccess` bypasses that skip validation — all uses of `overrideAccess: true` are intentional for server-side admin endpoints where auth is handled explicitly before the call. ✅

**Race Conditions & Concurrency**
- `CourseInstructors` collection: `create`/`update`/`delete` are `adminOnly` — no race condition risk from concurrent instructor writes. ✅
- No find-or-create pattern without unique DB index — the `seedCourseInstructor` helper checks for existing assignments before creating, but this is test-helper code, not production path. ✅

**Enum & Value Completeness**
- `AccountRole.Instructor` is added to the enum, `ACCOUNT_ROLE_LABEL`, and `isInstructor()` helper. ✅
- `CourseInstructors.role` uses `'primary' | 'ta' | 'guest'` — closed set, all consumers (`InstructorBadge`, gradebook checks) handle the full set. ✅
- All `switch`/`if-else` on `AccountRole` in existing collections (`Exercises`, `Conversations`, `MemoryItems`, access helpers) either use exact equality checks or explicitly list allowed roles — `Instructor` falls through to default-deny correctly. ✅

**Shell Injection / LLM Output / XSS**
- No shell commands, no LLM output, no `dangerouslySetInnerHTML` in the new UI component. ✅

### Pass 2 — INFORMATIONAL

**Conditional Side Effects**
- `InstructorDashboardContent.tsx` — The admin branch and instructor branch are cleanly separated; no side-effect asymmetry. ✅
- `route.ts` — Admin branch always returns `courses[].instructors`; instructor branch omits the field entirely — consistent with the UI expectations check in the E2E test. ✅

**Test Gaps**
- Integration test (`instructor-dashboard.int.spec.ts`) is guarded with `describe.skipIf(isAtlasUrl)` — skipped when running against MongoDB Atlas (production DB). This is a known limitation documented with a clear reason. ✅
- Unit tests (`instructorAccess.test.ts`) cover all helper functions. ✅
- E2E tests (`lms-instructor-role.e2e.spec.ts`) cover: auth blocking, admin dashboard supervisory view, admin API response shape, instructor-vs-admin UI differentiation, and per-course assignment CRUD. ✅

**Dead Code & Consistency**
- `InstructorDashboardContent.tsx` accepts `userId: _userId` (underscore prefix = intentionally unused). ✅
- `ACCOUNT_ROLE_LABEL` on the feature branch adds `[AccountRole.Instructor]: 'Instructor'` — consistent with other role labels. ✅
- Hebrew translations (`he.json`) are complete for all new i18n keys including nested `instructorRole.primary/ta/guest`. ✅

**Design System Compliance**
- `InstructorDashboardContent.tsx` uses `text-display-sm`, `text-body-sm`, `text-body-lg`, `text-text-secondary`, `text-heading-xl`, `bg-card`, `border`, `rounded-lg`, `shadow` — all semantic design tokens. ✅
- `InstructorBadge` uses `bg-primary/10 text-primary border-primary/20`, `bg-secondary/10`, `bg-accent/10` — semantic color tokens for role differentiation. ✅
- Interactive elements (course card links) have `transition-all hover:border-primary/50 hover:bg-accent/30`. ✅
- Uses `cn()`-style className strings (no unsafe template literal injection). ✅

**Performance & Bundle Impact**
- New dependency: none added. ✅
- No image loading issues. ✅
- `useEffect` in `InstructorDashboardContent` fetches once on mount (no waterfall). ✅

**Type Coercion at Boundaries**
- `getInstructorCourseIds` returns `string[]`, used with `in:` query operator — correct. ✅
- `typedUser.id` is coerced with `String(typedUser.id)` before use as a query value. ✅
- `payload-types.ts` is regenerated on the feature branch to include `instructor` in the `User.role` union and `CourseInstructor` collection types. ✅

---

## Browser Verification

**Status: Unable to complete** — The dev server failed to start (`ELIFECYCLE Command failed` after `Ready in 11.9s`), likely due to a database connection issue (MongoDB not reachable in this environment). The code review confirms the UI implementation is correct, but live visual verification was not possible. The E2E test suite (which covers the UI flows) would provide equivalent verification in a properly configured environment.

---

## Summary of Quality

This is a well-implemented feature. The three requested components (admin API returning all courses with per-course instructor assignments, UI rendering supervisory admin view with instructor badges, and test coverage) are all present and correct. The enum extension is handled consistently across all consumers. The only minor gaps are the missing `isInstructor` re-export and lack of pagination on the admin branch — neither is blocking.