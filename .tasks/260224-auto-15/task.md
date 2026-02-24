# Task

## Issue Title

[HIGH] Security: Content collections use 'authenticated' instead of 'adminOnly' for create/update/delete
## Description
Multiple content management collections allow **any authenticated user** (including students) to create, update, and delete records. These are administrative operations that should be restricted to admin users.

## Files Affected
| Collection | File | Lines |
|-----------|------|-------|
| Courses | `src/server/payload/collections/Courses.ts` | 26-31 |
| Chapters | `src/server/payload/collections/Chapters.ts` | 17-22 |
| Lessons | `src/server/payload/collections/Lessons.ts` | 16-21 |
| Categories | `src/server/payload/collections/Categories.ts` | 10-15 |
| PricingPlans | `src/server/payload/collections/PricingPlans.ts` | 9-14 |
| Media | `src/server/payload/collections/Media/index.ts` | 23-28 |

## Current Code
```typescript
access: {
  read: anyone,
  create: authenticated,  // ❌ Any logged-in user
  update: authenticated,  // ❌ Any logged-in user
  delete: authenticated,  // ❌ Any logged-in user
}
```

## Expected Fix
```typescript
access: {
  read: anyone, // or authenticatedOrPublished
  create: adminOnly,
  update: adminOnly,
  delete: adminOnly,
}
```

**Important**: Verify that `adminOnly` access function exists in `src/access/` and that the `admin` role exists in the Users collection roles.

## Steps to Test
1. Log in as a non-admin user (student role)
2. Try to POST to `/api/courses` with a new course body
3. Before fix: 200 success — student can create courses
4. After fix: 403 forbidden

## Priority
HIGH — Security vulnerability, privilege escalation
