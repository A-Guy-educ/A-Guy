
### build (2026-04-18T09:37:02)
The plan is written to the plan file and ready for your review. Here's a summary of what it proposes:

**API changes** (`src/app/api/instructor/dashboard/route.ts`): Replace the stub `courseIds = []` with a real query — admin branch fetches all courses and joins `course-instructors` to return `courses[].instructors[]` with `{ id, name, role }`.

**UI changes** (`InstructorDashboardContent.tsx`): Branch on `isAdmin` prop — admin sees all courses with instructor badges; instructor sees their own c
...(truncated)
