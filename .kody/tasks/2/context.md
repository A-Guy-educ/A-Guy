
### taskify (2026-04-19T15:17:16)
{"task_type":"feature","title":"Fix admin instructor dashboard stub","description":"Implement admin oversight view for instructor dashboard. Currently admins see empty results (totalCourses: 0, courses: []). Need to: (1) API returns all courses + per-course instructor assignments for admins, (2) UI renders supervisory admin view with course list and assigned instructors/TAs, (3) Add E2E and integration test coverage.","scope":["src/app/api/instructor/dashboard/route.ts","src/app/(frontend)/instr
...(truncated)

### plan (2026-04-19T15:23:56)
## Summary

**The implementation is already complete.** All three components requested in the PR #1266 comment are already on `origin/1244--featlms-instructor-role-per-course-permissi` at commit `ffe9cfe8`:

| Component | Status | Evidence |
|-----------|--------|----------|
| **API** (`route.ts`) | ✅ Done | Admin fetches all courses + course-instructors, builds `instructorsByCourse` map, returns `courses[].instructors` |
| **UI** (`InstructorDashboardContent.tsx`) | ✅ Done | `isAdmin` branch re
...(truncated)

### build (2026-04-19T15:42:40)
Stale notification. The implementation is verified and complete.

### review (2026-04-19T15:54:52)
Based on my thorough review of all changed and new files in the `1244--featlms-instructor-role-per-course-permissi` branch, here is my structured review:

---

## Verdict: PASS

## Summary

This PR adds the `Instructor` role to the RBAC system, a new `course-instructors` collection linking instructors to courses with per-course permissions (primary/TA/guest), a new instructor dashboard API, a supervisory admin view at `/instructor`, a gradebook API, and comprehensive test coverage. All three req
...(truncated)
