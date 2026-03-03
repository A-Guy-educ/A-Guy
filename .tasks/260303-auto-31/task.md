# Task

## Issue Title

Security: Content collections (Courses, Chapters, Lessons) expose draft/archived content publicly
## Description

All three hierarchical content collections have `read: anyone` access, meaning unauthenticated users and the public API can read **draft and archived content**. Each collection has a `status` field with `draft`, `published`, and `archived` options, but the access control does not filter by status.

The AGENTS.md explicitly recommends the `authenticatedOrPublished` pattern for this exact scenario.

## Current Behavior

```typescript
// Courses.ts, Chapters.ts, Lessons.ts
access: {
  read: anyone,  // Public sees EVERYTHING including drafts
  // ...
}
```

Draft courses, unpublished chapters, and archived lessons are all visible to anonymous users via the REST API.

## Expected Behavior

```typescript
// Follow the authenticatedOrPublished pattern from Pages/Posts:
access: {
  read: ({ req: { user } }) => {
    if (user) return true  // Authenticated sees all
    return {
      status: { equals: 'published' },
      isActive: { equals: true }
    }
  },
}
```

## Files to Change

- `src/server/payload/collections/Courses.ts` — change `read: anyone` to `authenticatedOrPublished`
- `src/server/payload/collections/Chapters.ts` — change `read: anyone` to `authenticatedOrPublished`
- `src/server/payload/collections/Lessons.ts` — change `read: anyone` to `authenticatedOrPublished`
- `src/server/payload/access/` — may need to create or reuse `authenticatedOrPublished` access function
- Frontend pages that query these collections — verify they still work (authenticated queries should be unaffected)

## Complexity

Complex — 3+ collection files, access control function creation, and all frontend queries must be tested to ensure authenticated admin/teacher views still work while public views filter correctly.

## Labels

security, bug
