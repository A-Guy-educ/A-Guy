# Plan: Fix validateContextAccess() enrollment check

## Rerun Context

This is a rerun after initial implementation. The feedback simply states "Rerun requested via /cody rerun" with no specific issues identified. The plan below addresses the original bug: `validateContextAccess()` always returns true without checking enrollment.

---

## Bug Summary

**Root Cause**: In `src/server/services/conversation-service.ts`, the `validateContextAccess()` method returns `true` for all authenticated users without checking actual enrollment. This is a security vulnerability - any authenticated user can access any course's chat context.

**Affected**: 
- `src/server/services/conversation-service.ts` (validateContextAccess method)
- `src/server/services/conversation-service.ts` (validateGuestContextAccess method)

---

## Step 1: Create Enrollments Collection

**Root Cause**: No enrollment data model exists - the bug cannot be fixed without tracking which users are enrolled in which courses.

**Files to Touch**:

- `src/server/payload/collections/Enrollments.ts` (NEW FILE)

**Reproduction Test**: 
- Test location: `tests/unit/lib/services/conversation-service.spec.ts`
- What it tests: Currently line 330-339 shows placeholder test expecting `true` for all students
- Why it fails: The validateContextAccess returns true without enrollment check

**Implementation**:
Create Enrollments collection with:
- `user`: relationship to users (required)
- `course`: relationship to courses (required)
- `enrolledAt`: date (auto-set on creation)
- `status`: select ['active', 'suspended', 'completed'], default 'active'
- `accessType`: select ['free', 'paid'], default 'paid'

Access control:
- Admin: full access
- Users: can read own enrollments, cannot modify

**Verification**:
- Run `pnpm generate:types` after creating collection
- Run `pnpm tsc --noEmit` to verify types

---

## Step 2: Fix validateContextAccess to check enrollment

**Root Cause**: Method unconditionally returns true after admin check, bypassing enrollment validation entirely.

**Files to Touch**:

- `src/server/services/conversation-service.ts` (MODIFIED - lines 286-329)

**Reproduction Test**:
- Test location: `tests/unit/lib/services/conversation-service.spec.ts`
- New test: `should deny non-enrolled student access to course`
- Test verifies: Non-enrolled student gets `false` from validateContextAccess
- Current behavior: Returns `true` (bug)
- Expected after fix: Returns `false`

**Implementation**:
1. After admin bypass, traverse context hierarchy (exercise→lesson→chapter→course) to find course ID
2. Query enrollments collection for (user, course) with status='active'
3. Return true only if valid enrollment exists
4. Add helper method `isEnrolledInCourse(userId, courseId)` for reusability

**Code Pattern**:
```typescript
async isEnrolledInCourse(userId: string, courseId: string): Promise<boolean> {
  const enrollment = await this.payload.find({
    collection: 'enrollments',
    where: {
      and: [
        { user: { equals: userId } },
        { course: { equals: courseId } },
        { status: { equals: 'active' } },
      ],
    },
    limit: 1,
    select: { id: true }, // Don't expose full enrollment data
  })
  return enrollment.docs.length > 0
}
```

**Verification**:
- Run unit tests → previously failing test now passes
- Run `pnpm tsc --noEmit`

---

## Step 3: Update validateGuestContextAccess

**Root Cause**: Guests have open access to all content, which may need restriction to free content only.

**Files to Touch**:

- `src/server/services/conversation-service.ts` (MODIFIED - lines 335-342)

**Reproduction Test**:
- Test location: `tests/unit/lib/services/conversation-service.spec.ts`
- New test: `should deny guest access to paid course content`
- Test verifies: Guest access returns false for paid course

**Implementation**:
Option A (restrict to free): Check if course has free content access
- Query course to check accessType
- Return true only if accessType='free'

Option B (require enrollment): Deny all guest access to course content
- Return false for courses/lessons/exercises (keep open for categories)

Document chosen approach in code comments.

**Verification**:
- Run unit tests
- Run `pnpm tsc --noEmit`

---

## Step 4: Add unit tests for enrollment validation

**Root Cause**: No tests exist to verify enrollment checking behavior.

**Files to Touch**:

- `tests/unit/lib/services/conversation-service.spec.ts` (MODIFIED - add new test cases)

**Test Cases to Add**:
1. `should allow admin access to any context` - admin bypass (already exists, verify)
2. `should allow enrolled student access to course` - enrollment grants access
3. `should deny non-enrolled student access to course` - enrollment required
4. `should traverse hierarchy: exercise→course` - find course from exercise
5. `should traverse hierarchy: lesson→course` - find course from lesson
6. `should deny guest access to paid course` - guest restrictions
7. `should allow guest access to free course` - guest with free access

**Verification**:
- Run `pnpm test:unit -- --run tests/unit/lib/services/conversation-service.spec.ts`
- All new tests pass

---

## Acceptance Criteria Checklist

- [ ] Enrollments collection created with proper fields and access control
- [ ] TypeScript compilation passes (`pnpm tsc --noEmit`)
- [ ] validateContextAccess checks enrollment before granting access
- [ ] Admin users bypass enrollment check
- [ ] Non-enrolled users are denied access
- [ ] Guest access restricted appropriately
- [ ] Unit tests pass for enrollment validation
- [ ] Generated types updated (`pnpm generate:types`)
