# Specification (promoted)

Skipped via input_quality — taskify determined spec is unnecessary.

## Requirements

# Task

## Issue Title

[HIGH] Bug: Draft content publicly readable via API
## Description
The `courses`, `chapters`, and `lessons` collections use `read: anyone` with no status filter. This means draft and archived content is visible to anonymous API consumers.

## Files Affected
- `src/server/payload/collections/Courses.ts` — line 29: `read: anyone`
- `src/server/payload/collections/Chapters.ts` — line 20: `read: anyone`
- `src/server/payload/collections/Lessons.ts` — line 19: `read: anyone`

All three have a `status` field with options `draft | published | archived` but the read access doesn't filter by it.

## Expected Fix
Replace `read: anyone` with a status-aware access function:
```typescript
read: ({ req: { user } }) => {
  if (user) return true // Authenticated users see all
  return { status: { equals: 'published' } } // Anonymous see only published
}
```

> **IMPORTANT**: Do NOT use the `authenticatedOrPublished` function from Pages/Posts collections. That function filters by `_status` (Payload's built-in draft field), but these collections use a custom `status` field (`draft | published | archived`) without draft versioning enabled. The inline function above is the correct approach.

## Steps to Test
1. Log out (anonymous user)
2. Hit `GET /api/courses` directly in browser
3. Before fix: draft/archived courses appear in response
4. After fix: only published courses appear

## Priority
HIGH — Data leak, unpublished content visible to public


## Acceptance Criteria

- [ ] Fix applied as described in task.md
- [ ] TypeScript compilation passes
- [ ] Unit tests pass
