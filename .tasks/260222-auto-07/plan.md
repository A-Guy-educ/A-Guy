# Bug Fix Plan: validateContextAccess() always returns true

## Rerun Context

This is a rerun of a previous attempt. No specific feedback was provided - just a general rerun request.

## Issue Summary

**Root Cause**: In `src/server/services/conversation-service.ts`, the `validateContextAccess()` method has TODO comments indicating enrollment is NOT validated. All authenticated users can access any course/lesson/exercise context regardless of enrollment.

**Expected**: Only enrolled users (or admins) can access a course's chat context.
**Actual**: All authenticated users pass the access check.

## Investigation Results

The codebase has NO existing enrollment system:
- No `enrollments` collection
- No `enrolledCourses` relationship on Users
- No `students` relationship on Courses

A new Enrollments collection must be created to track user course enrollments.

---

## Step 1: Create Enrollments Collection

**Files to Touch**:
- `src/server/payload/collections/Enrollments.ts` (NEW)
- `src/payload.config.ts` (MODIFIED - add import and include in collections array)

**Reproduction Test**: Write a test that demonstrates the bug - currently `validateContextAccess` always returns true for authenticated users:

- Test location: `tests/unit/lib/services/conversation-service.spec.ts`
- What it tests: `validateContextAccess` for non-admin user should check enrollment
- Why it fails: Currently returns `true` without checking enrollment

**Implementation**:
1. Create `Enrollments` collection with fields:
   - `user`: relationship to users (required, indexed)
   - `course`: relationship to courses (required, indexed)
   - `enrolledAt`: date (auto-set on creation via hook)
   - `status`: select ['active', 'suspended', 'completed'], default 'active'
   - `accessType`: select ['free', 'paid'], default 'paid'

2. Access control:
   - Admin: full access (create, read, update, delete)
   - Users: can read their own enrollments only (use `select` to limit exposed fields), cannot modify

3. Add unique compound index on (user, course) to prevent duplicate enrollments

4. **Security**: Use `select` to limit fields returned (e.g., only return id and status) to prevent data leakage in API responses

**Verification**:
- Run `pnpm generate:types` to generate new types
- Existing tests pass

---

## Step 2: Implement validateContextAccess Enrollment Check

**Files to Touch**:
- `src/server/services/conversation-service.ts` (MODIFIED - lines 300-344)

**Reproduction Test**: Same as Step 1 - verifies enrollment is now checked:

- Test: Non-enrolled student accessing course context should be denied
- Why it fails: Before fix, returns `true`; after fix, should return `false`

**Implementation**:
1. Add helper method `isEnrolledInCourse(userId, courseId)` that:
   - Queries enrollments collection for (user, course) with status='active'
   - Use `select: { id: true, accessType: true }` to limit returned fields (security)
   - Returns true if enrollment exists

2. Update `validateContextAccess` method:
   - Check if user is admin → allow
   - Traverse context hierarchy (exercise→lesson→chapter→course) to find course ID
   - Call `isEnrolledInCourse` to verify enrollment
   - Return true only if valid enrollment exists

3. Use `overrideAccess: false` when checking to enforce access control

4. **Security**: Log access denied events for audit purposes using the existing logger

**Verification**:
- Unit test passes: admin bypass works
- Unit test passes: enrolled user access granted  
- Unit test passes: non-enrolled user access denied

---

## Step 3: Update Guest Access Logic

**Files to Touch**:
- `src/server/services/conversation-service.ts` (MODIFIED - lines 346-358)

**Reproduction Test**: 
- Test: Guest should NOT have access to paid content
- Why it fails: Currently returns `true` for all guests

**Implementation**:
1. Update `validateGuestContextAccess` to:
   - Traverse context hierarchy to find course ID
   - Query enrollments collection to find any active enrollment for the guest's session owner (if upgrading from guest)
   - Check if course has free access by:
     - First checking enrollment's `accessType` field (if enrolled)
     - Or falling back to course's default access settings
   - Only allow guest access if accessType='free'
   - Otherwise deny guest access

2. **Security**: Use `select` to limit returned fields when querying

**Verification**:
- Unit test passes: guest can access free content
- Unit test passes: guest cannot access paid content

---

## Step 4: Add Unit Tests for Enrollment Validation

**Files to Touch**:
- `tests/unit/lib/services/conversation-service.spec.ts` (MODIFIED - add new tests)

**Tests to Add**:
1. `validateContextAccess` - admin bypass
2. `validateContextAccess` - enrolled user access granted
3. `validateContextAccess` - non-enrolled user access denied
4. `validateContextAccess` - context hierarchy traversal (exercise→course, lesson→course)
5. `validateGuestContextAccess` - guest access to free content
6. `validateGuestContextAccess` - guest denied for paid content

**Verification**:
- All new tests pass
- Existing tests continue to pass

---

## Acceptance Criteria Checklist

- [ ] Enrollments collection created with proper schema
- [ ] TypeScript compilation passes (`pnpm tsc --noEmit`)
- [ ] Types generated (`pnpm generate:types`)
- [ ] validateContextAccess checks enrollment properly
- [ ] Admin users bypass enrollment check
- [ ] Non-enrolled users are denied access
- [ ] Guest access restricted to free content only
- [ ] Unit tests pass for enrollment validation
- [ ] Backward compatibility maintained with existing chat API contracts

---

## Dependencies & Order

1. **Create Enrollments collection** (Step 1) - Must be done first
2. **Generate types** - After Step 1
3. **Update validateContextAccess** (Step 2) - Depends on Step 1
4. **Update guest access** (Step 3) - Depends on Step 1-2
5. **Add tests** (Step 4) - Can be done in parallel with Steps 2-3
