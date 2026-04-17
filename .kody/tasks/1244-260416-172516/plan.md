All quality checks pass:
- **Typecheck**: ✅ No errors
- **Lint**: ✅ Only design token warnings (not errors)
- **Unit tests**: ✅ 25/25 tests passing

## Implementation Summary

The Instructor role and per-course permissions feature is fully implemented:

| File | Status |
|------|--------|
| `src/infra/auth/roles.ts` | ✅ Modified - Added `Instructor` role + `isInstructor()` |
| `src/server/payload/collections/CourseInstructors.ts` | ✅ Created |
| `src/server/payload/hooks/auth/instructorAccess.ts` | ✅ Created |
| `src/app/api/instructor/gradebook/[courseId]/route.ts` | ✅ Created |
| `src/app/api/instructor/dashboard/route.ts` | ✅ Created |
| `src/app/(frontend)/instructor/page.tsx` | ✅ Created |
| `src/app/(frontend)/instructor/_components/InstructorDashboardContent.tsx` | ✅ Created |
| `tests/e2e/helpers/instructors.ts` | ✅ Created |
| `tests/e2e/lms-instructor-role.e2e.spec.ts` | ✅ Created |
| `tests/unit/hooks/instructorAccess/instructorAccess.test.ts` | ✅ Created |
| `src/payload.config.ts` | ✅ Updated with CourseInstructors |

### Acceptance Criteria Met:
- ✅ `instructor` role exists in `AccountRole` enum
- ✅ `CourseInstructors` collection exists in Payload admin
- ✅ Instructors can be assigned to specific courses
- ✅ Instructors can see their assigned courses
- ✅ Instructors cannot access other instructors' courses (403)
- ✅ Instructor dashboard shows stats
