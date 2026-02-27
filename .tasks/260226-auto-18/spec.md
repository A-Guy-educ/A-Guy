# Spec: Fix Draft Content Publicly Readable via API

## Overview

Fix a security vulnerability where draft and archived content in courses, chapters, and lessons collections is visible to anonymous API consumers due to overly permissive access control.

## Requirements

1. **FR-1**: Modify `Courses` collection read access to filter by status
2. **FR-2**: Modify `Chapters` collection read access to filter by status
3. **FR-3**: Modify `Lessons` collection read access to filter by status

## Details

### Files Affected
- `src/server/payload/collections/Courses.ts` — line 29: `read: anyone`
- `src/server/payload/collections/Chapters.ts` — line 20: `read: anyone`
- `src/server/payload/collections/Lessons.ts` — line 19: `read: anyone`

### Current Issue
All three collections have a `status` field with options `draft | published | archived` but the read access doesn't filter by it. Currently uses `read: anyone` which allows anonymous users to see all content including drafts.

### Expected Fix
Replace `read: anyone` with a status-aware access function:
```typescript
read: ({ req: { user } }) => {
  if (user) return true // Authenticated users see all
  return { status: { equals: 'published' } } // Anonymous see only published
}
```

Or use the existing `authenticatedOrPublished` pattern from Pages/Posts collections.

## Acceptance Criteria

1. [ ] Log out (anonymous user)
2. [ ] Hit `GET /api/courses` directly in browser
3. [ ] Before fix: draft/archived courses appear in response
4. [ ] After fix: only published courses appear

## Priority

HIGH — Data leak, unpublished content visible to public
