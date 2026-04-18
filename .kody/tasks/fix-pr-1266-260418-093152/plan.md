# Plan: Admin Dashboard View for Instructor Role Feature

## Context

PR #1266 implemented the Instructor role with per-course permissions. The admin branch in the instructor dashboard was stubbed with a TODO — admins always see an empty course list. This fix expands the admin view to show all courses with their assigned instructors/TAs, enabling supervisory oversight without touching instructor-specific routes.

## Changes

### 1. API — `src/app/api/instructor/dashboard/route.ts`

**Goal**: Return all courses (no filter) for admins, with per-course instructor assignments.

**Logic**:
- Admin branch: fetch all courses via `payload.find({ collection: 'courses', limit: 1000, overrideAccess: true })`
- Fetch all `course-instructors` assignments in one query (admin has read access)
- For each course, map its instructor IDs to names/roles from the joined `instructor` relationship
- Build `instructors[]` array: `Array<{ id, name, role: 'primary' | 'ta' | 'guest' }>`
- Return same shape as instructor path but with `courses[].instructors` added and `totalStudents` aggregated across all courses

**Response shape (admin)**:
```json
{
  "success": true,
  "data": {
    "courses": [
      {
        "id": "...",
        "title": "...",
        "slug": "...",
        "courseLabel": "...",
        "instructors": [
          { "id": "userId", "name": "John Doe", "role": "primary" },
          { "id": "userId2", "name": "Jane TA", "role": "ta" }
        ]
      }
    ],
    "totalStudents": 42,
    "totalCourses": 3
  }
}
```

**Response shape (instructor — unchanged)**:
```json
{
  "success": true,
  "data": {
    "courses": [{ "id", "title", "slug", "courseLabel" }],
    "totalStudents": 10,
    "totalCourses": 1
  }
}
```

### 2. UI — `src/app/(frontend)/instructor/_components/InstructorDashboardContent.tsx`

**Goal**: Branch on `isAdmin` prop to render a supervisory view.

**Changes**:
- `isAdmin` prop is already passed in (was unused `_isAdmin`)
- Add `instructors?: Array<{ id: string; name: string; role: 'primary' | 'ta' | 'guest' }>` to `Course` interface
- Two render branches:
  - **Admin view**: Show all courses with their instructors listed; stat cards show all-courses aggregate; heading "All Courses"
  - **Instructor view**: Keep existing behavior; heading "Your Courses"
- Admin course card shows instructor badges (role label + name) instead of arrow

**New translations** (`src/i18n/en.json` + `src/i18n/he.json`):
- `lms.instructor.adminTitle`: "Course Oversight" / Hebrew equivalent
- `lms.instructor.adminSubtitle`: "Supervise instructor assignments across all courses"
- `lms.instructor.allCourses`: "All Courses"
- `lms.instructor.instructorRole.primary`: "Primary"
- `lms.instructor.instructorRole.ta`: "TA"
- `lms.instructor.instructorRole.guest`: "Guest"

### 3. Tests

**Unit tests** (`tests/unit/api/instructor-dashboard/`):
- `route.test.ts` — mock `payload.find` for admin path; assert correct course/instructor shape returned

**Integration tests** (`tests/int/instructor-dashboard.int.spec.ts`):
- Create admin user, seed 2 courses with 3 assignments
- Hit `/api/instructor/dashboard` as admin
- Assert `data.totalCourses === 2`, `data.courses[0].instructors.length === 2`

**E2E tests** (`tests/e2e/lms-instructor-role.e2e.spec.ts` — extend existing file):
- `test('admin sees all courses with instructors in dashboard')` — login as admin, navigate to `/instructor`, assert courses appear with instructor names visible

## Verification

1. `pnpm tsc --noEmit` — typecheck passes
2. `pnpm lint` — lint passes (design token warnings only)
3. `pnpm test:int` — integration tests pass
4. `pnpm test:e2e` — E2E tests pass
5. Browser: admin at `/instructor` sees all courses with instructor badges
6. Browser: instructor at `/instructor` sees their courses (unchanged)
