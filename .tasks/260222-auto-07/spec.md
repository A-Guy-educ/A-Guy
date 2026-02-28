# Specification (promoted)

Skipped via input_quality — taskify determined spec is unnecessary.

## Requirements

# Task

## Issue Title

Bug: validateContextAccess() always returns true — enrollment not checked
**Description**
In `src/server/services/conversation-service.ts`, the `validateContextAccess()` 
method has TODO comments indicating enrollment is NOT validated. All authenticated 
users can access any course/lesson/exercise context regardless of enrollment.

**Expected**: Only enrolled users (or admins) can access a course's chat context.
**Actual**: All authenticated users pass the access check.

**Files affected**:
- `src/server/services/conversation-service.ts` (validateContextAccess method)

**Notes**:
- The fix requires querying enrollment relationships, but the enrollment 
  data model is not specified here. Investigate before implementing.
- The guest access method (`validateGuestContextAccess`) may also need updating.
- Access control changes need tests.


## Data Model Investigation Results

After analyzing the codebase, the following gaps were identified:

### Missing: Enrollment Data Model

The codebase currently has NO enrollment system. The following do NOT exist:
- No `enrollments` collection
- No `enrolledCourses` relationship on Users
- No `students` relationship on Courses
- Access types (`free`, `mandatory`, `gated`) are client-side only (UI hints), not server-side access control

### Required Implementation: New Enrollments Collection

A new collection must be created to track user course enrollments:

```
Enrollments Collection:
- user: relationship to users (required)
- course: relationship to courses (required)
- enrolledAt: date (auto-set on creation)
- status: select (active, suspended, completed)
- accessType: select (free, paid) - overrides course defaults
```

### Context Hierarchy Traversal

The validateContextAccess must traverse up the hierarchy to find the course:
- exercises → lessons → chapters → courses
- Check enrollment against the root course

### Guest Access Considerations

Guest sessions (`validateGuestContextAccess`) should:
- Either restrict guest chat to free content only
- Or require enrollment even for guests (depending on business logic)


## Acceptance Criteria

- [ ] Fix applied as described in task.md
- [ ] TypeScript compilation passes
- [ ] Unit tests pass

## Functional Requirements (FR)

### FR-ENROLL-001: Create Enrollments Collection
Create a new Payload collection `enrollments` with:
- `user`: relationship to users (required)
- `course`: relationship to courses (required)  
- `enrolledAt`: date (auto-set on creation)
- `status`: select ['active', 'suspended', 'completed'], default 'active'
- `accessType`: select ['free', 'paid'], default 'paid'

Access control:
- Admin: full access (create, read, update, delete)
- Users: can read their own enrollments, cannot modify

### FR-ENROLL-002: Implement validateContextAccess Enrollment Check
Update the `validateContextAccess` method to:
1. Check if user is admin → allow
2. Traverse context hierarchy (exercise→lesson→chapter→course) to find course ID
3. Query enrollments collection for (user, course) with status='active'
4. Return true only if valid enrollment exists

### FR-ENROLL-003: Update Guest Access Logic  
Update `validateGuestContextAccess` to:
- Option A: Restrict guest chat to courses with accessType='free' only
- Option B: Require enrollment even for guests (treat guests as unauthenticated users)
- Document the chosen approach in code

### FR-ENROLL-004: Add Unit Tests
Add unit tests for enrollment validation:
- Test admin bypass
- Test enrolled user access granted
- Test non-enrolled user access denied
- Test context hierarchy traversal (exercise→course, lesson→course)
- Test guest access restrictions


## Non-Functional Requirements (NFR)

### NFR-ENROLL-001: Performance
- Enrollment check must use a single database query with proper indexing
- Use `overrideAccess: false` when checking to enforce access control
- Cache enrollment status in request context if checking multiple contexts

### NFR-ENROLL-002: Security
- Never expose enrollment data in API responses (use `select` to limit fields)
- Ensure proper transaction safety by passing `req` to nested operations
- Log access denied events for audit purposes

### NFR-ENROLL-003: Type Safety
- Generate types after creating the Enrollments collection
- Use proper TypeScript types for enrollment data structures
- Ensure backward compatibility with existing chat API contracts
