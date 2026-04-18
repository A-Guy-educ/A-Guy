
### build (2026-04-18T09:37:02)
The plan is written to the plan file and ready for your review. Here's a summary of what it proposes:

**API changes** (`src/app/api/instructor/dashboard/route.ts`): Replace the stub `courseIds = []` with a real query — admin branch fetches all courses and joins `course-instructors` to return `courses[].instructors[]` with `{ id, name, role }`.

**UI changes** (`InstructorDashboardContent.tsx`): Branch on `isAdmin` prop — admin sees all courses with instructor badges; instructor sees their own c
...(truncated)

### review (2026-04-18T09:43:51)
Now I have a complete picture. Let me write the structured review.

## Verdict: PASS

## Summary

The plan implements the admin dashboard view for the Instructor role feature by: (1) expanding the admin branch in the dashboard API to return all courses with per-course instructor assignments, (2) branching the UI on `isAdmin` to render a supervisory view with instructor badges, and (3) adding unit/integration/E2E tests plus missing translations. The plan is well-scoped, uses existing infrastructu
...(truncated)

### review-fix (2026-04-18T09:47:35)
The plan file at `plan.md` is already comprehensive and covers everything needed. Here's a summary of what the plan proposes:

**1. API** (`src/app/api/instructor/dashboard/route.ts`):
- Replace `courseIds = []` admin stub with a real query that fetches all courses
- Batch-fetch all `course-instructors` assignments (avoiding N+1)
- Join the `instructor` relationship to get names
- Return `courses[].instructors: Array<{ id, name, role }>` for admin

**2. UI** (`InstructorDashboardContent.tsx`):
-
...(truncated)
