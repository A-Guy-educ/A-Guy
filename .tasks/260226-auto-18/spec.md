# Spec: Fix Draft Content Publicly Readable via API

## Overview
The `courses`, `chapters`, and `lessons` collections have a security bug where draft and archived content is visible to anonymous API consumers due to `read: anyone` access control with no status filter.

## Requirements

- FR-1: Anonymous users should only see published content
- FR-2: Authenticated users should see all content (draft, published, archived)
- FR-3: Apply the same access pattern to courses, chapters, and lessons collections

## Files Affected
- `src/server/payload/collections/Courses.ts` — line 29: `read: anyone`
- `src/server/payload/collections/Chapters.ts` — line 20: `read: anyone`
- `src/server/payload/collections/Lessons.ts` — line 19: `read: anyone`

All three collections have a `status` field with options `draft | published | archived` but the read access doesn't filter by it.

## Expected Implementation

Replace `read: anyone` with an inline status-aware access function (note: use `status`, NOT `_status` - this is different from Pages/Posts which use Payload's built-in draft system):

```typescript
read: ({ req: { user } }) => {
  if (user) return true // Authenticated users see all
  return { status: { equals: 'published' } } // Anonymous see only published
}
```

**Note:** The existing `authenticatedOrPublished` pattern in `src/server/payload/access/authenticatedOrPublished.ts` uses `_status` (for collections with `versions: { drafts: true }`). This fix requires a custom implementation using the custom `status` field.

## Acceptance Criteria

1. Log out (anonymous user)
2. Hit `GET /api/courses` directly in browser
3. Before fix: draft/archived courses appear in response
4. After fix: only published courses appear

Same test should apply to chapters and lessons endpoints.

## Priority
HIGH — Data leak, unpublished content visible to public
