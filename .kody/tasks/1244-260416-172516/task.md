# feat(LMS): Instructor role + per-course permissions


## Context

Currently the platform has four account roles: `Admin`, `Student`, `ContentEditor`, and `AdvancedContentEditor` (in `src/server/payload/collections/Users/roles.ts`). There is **no Instructor role**. `TeacherProfiles` exist in `src/server/payload/collections/TeacherProfiles.ts` but only control AI chat behavior — they are not a system role and carry no permissions.

Instructors are a fundamental LMS concept: someone who creates/teaches courses and can see their students' progress.

## What Is Missing

1. **No `Instructor` role** in `AccountRole` — cannot distinguish instructors from content editors
2. **No per-course permissions** — ContentEditors have access to ALL courses, not specific ones
3. **No instructor dashboard** — instructors cannot see their assigned courses or students
4. **No course-instructor assignment** — no way to link an instructor to specific courses
5. **No role request/approval workflow** — no way to request the instructor role

## Implementation Approach (Payload-First)

### Step 1: Extend `AccountRole` Enum

**File:** `src/server/payload/collections/Users/roles.ts`

```typescript
export const AccountRole = {
  ADMIN: "admin",
  STUDENT: "student",
  CONTENT_EDITOR: "content-editor",
  ADVANCED_CONTENT_EDITOR: "advanced-content-editor",
  INSTRUCTOR: "instructor", // NEW
} as const
```

### Step 2: Create `CourseInstructors` Payload Collection

**File:** `src/server/payload/collections/CourseInstructors.ts`

```typescript
import type { CollectionConfig } from "payload"

export const CourseInstructors: CollectionConfig = {
  slug: "course-instructors",
  admin: { description: "Assign instructors to specific courses" },
  fields: [
    { name: "instructor", type: "relationship", relationTo: "users", required: true,
      filter: { "role.value": { equals: "instructor" } } },
    { name: "course", type: "relationship", relationTo: "courses", required: true },
    {
      name: "role", type: "select", defaultValue: "primary",
      options: [
        { label: "Primary Instructor", value: "primary" },
        { label: "Teaching Assistant", value: "ta" },
        { label: "Guest Lecturer", value: "guest" },
      ],
    },
    { name: "canGrade", type: "checkbox", defaultValue: true },
    { name: "canMessageStudents", type: "checkbox", defaultValue: true },
    { name: "assignedAt", type: "date", admin: { readOnly: true } },
  ],
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === "admin") return true
      if (user.role === "instructor") return { instructor: { equals: user.id } }
      return false
    },
    create: ({ req: { user } }) => user?.role === "admin",
    update: ({ req: { user } }) => user?.role === "admin",
    delete: ({ req: { user } }) => user?.role === "admin",
  },
}
```

### Step 3: Access Control Hook

**File:** `src/server/payload/hooks/auth/instructorAccess.ts`

```typescript
export const isInstructorForCourse = async (req, userId: string, courseId: string): Promise<boolean> => {
  const { payload } = req
  const assignment = await payload.find({
    collection: "course-instructors",
    where: { instructor: { equals: userId }, course: { equals: courseId } },
    limit: 1,
  })
  return assignment.docs.length > 0
}

export const isInstructor = (user: User): boolean => user?.role === "instructor"
```

### Step 4: Instructor Dashboard

**File:** `src/app/(frontend)/instructor/page.tsx`

### Step 5: Gradebook API

**File:** `src/app/api/instructor/gradebook/[courseId]/route.ts`

## Files to Create

| File | Action |
|---|---|
| `src/server/payload/collections/Users/roles.ts` | Modify — add Instructor role |
| `src/server/payload/collections/CourseInstructors.ts` | Create |
| `src/server/payload/hooks/auth/instructorAccess.ts` | Create |
| `src/app/api/instructor/gradebook/[courseId]/route.ts` | Create |
| `src/app/(frontend)/instructor/page.tsx` | Create |

## Acceptance Criteria

- [ ] `instructor` role exists in `AccountRole` enum
- [ ] `CourseInstructors` collection exists in Payload admin
- [ ] Instructors can be assigned to specific courses
- [ ] Instructors can see their assigned courses and student progress
- [ ] Instructors cannot access other instructors' courses
- [ ] Instructor dashboard shows enrollment counts and grades

---

## Test Strategy

### Unit Tests (`tests/unit/instructor/`)
Pure permission logic.

```
isInstructor(user) returns true for instructor role
isInstructor(user) returns false for student role
isInstructorForCourse() returns true when assignment exists
isInstructorForCourse() returns false for unassigned course
isInstructorForCourse() returns false for non-instructor user
```

### Integration Tests (`tests/int/instructor/`)
API + DB via Payload test API.

```
GET /api/instructor/gradebook/[courseId] → instructor sees their students
GET /api/instructor/gradebook/[courseId] → instructor gets 403 for unassigned course
GET /api/instructor/gradebook/[courseId] → admin sees all students
POST /api/course-instructors → admin can assign instructor to course
DELETE /api/course-instructors/[id] → admin can remove assignment
```

### E2E Tests (`tests/e2e/lms-instructor-role.e2e.spec.ts`)
Critical browser journey.

```
instructor can see only their assigned courses in dashboard
student cannot access instructor dashboard
```

### Helper
`tests/e2e/helpers/instructors.ts`
```ts
async function seedCourseInstructor(payload, instructorId: string, courseId: string, role = 'primary')
```


---

## Discussion (9 comments)

**@aguyaharonyair** (2026-04-16):

@kody

Execute this issue. This is a **P0 LMS feature** — add the Instructor role + per-course permissions.

Key constraints:
- Use **Payload-first** approach: Payload collections, access control, hooks
- The implementation plan is fully detailed in the issue body above
- This does NOT depend on other P0 issues — run in parallel with #1243, #1245, and #1247
- Instructor gradebook (#1251) will build on this — keep the CourseInstructors collection clean
- See the Files to Create table and Acceptance Criteria at the bottom of the issue body


**@aguyaharonyair** (2026-04-16):


## Test Scenarios for This Feature

Add E2E tests to `tests/e2e/lms-instructor-role.e2e.spec.ts` using the existing Playwright + auth helpers pattern.

**Helper to create:** `tests/e2e/helpers/instructors.ts`
```ts
async function seedCourseInstructor(payload, instructorId: string, courseId: string, role = 'primary')
```

**Test scenarios (instructor journey):**
1. `instructor can see only their assigned courses in dashboard`
2. `instructor cannot access another instructor's course data`
3. `instructor can view student progress for their course`
4. `instructor with TA role can grade`

**Test scenarios (admin journey):**
5. `admin can assign instructor to a course in Payload admin`
6. `admin can remove instructor from course`
7. `student cannot access instructor dashboard`
8. `instructor cannot access Payload admin collections`

**Note:** Instructor gradebook tests go in #1251 — keep this focused on role + permissions.
**Helper:** Use `seedTestCourseData()` + `createTestUser()` + `loginAsAdmin()` from `helpers/auth.ts`


**@aguyaharonyair** (2026-04-16):
@kody please execute

**@aguyaharonyair** (2026-04-16):
@kody

**@aguyaharonyair** (2026-04-16):
🚀 Kody pipeline started: `1244-260416-154729` ([logs](https://github.com/A-Guy-educ/A-Guy/actions/runs/24519842215))

**@aguyaharonyair** (2026-04-16):
@kody

**@aguyaharonyair** (2026-04-16):
@kody

**@aguyaharonyair** (2026-04-16):
🚀 Kody pipeline started: `1244-260416-172516` ([logs](https://github.com/A-Guy-educ/A-Guy/actions/runs/24524280605))

**@aguyaharonyair** (2026-04-17):
@kody rerun

