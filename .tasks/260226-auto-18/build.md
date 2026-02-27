# Build Agent Report: 260226-auto-18

## Changes

- **Created** `src/server/payload/access/publishedOrAuthenticated.ts` - New access function that returns `true` for authenticated users and `{ status: { equals: 'published' } }` for anonymous users (uses custom `status` field, not `_status`)
- **Modified** `src/server/payload/collections/Courses.ts` - Replaced `read: anyone` with `read: publishedOrAuthenticated` to restrict anonymous API access to published content only
- **Modified** `src/server/payload/collections/Chapters.ts` - Replaced `read: anyone` with `read: publishedOrAuthenticated` to restrict anonymous API access to published content only
- **Modified** `src/server/payload/collections/Lessons.ts` - Replaced `read: anyone` with `read: publishedOrAuthenticated` to restrict anonymous API access to published content only
- **Modified** `tests/unit/access/content-collections-admin-only.test.ts` - Updated test assertions to expect `publishedOrAuthenticated` instead of `anyone` for Courses, Chapters, and Lessons read access

## Tests Written

- `tests/unit/access/publishedOrAuthenticated.test.ts` - Tests the new access function behavior (5 tests)
- `tests/unit/access/content-read-access.test.ts` - Tests that collection read access is properly restricted (12 tests)

## Quality

- TypeScript: PASS
- Lint: PASS (remaining warnings are pre-existing, unrelated to changes)
- Unit Tests: PASS (2466 tests passing)

## Security Fix Summary

The fix addresses a HIGH priority data leak where draft and archived content in courses, chapters, and lessons collections was publicly readable via the API:

- **Before**: `read: anyone` allowed any API consumer to see all content regardless of status
- **After**: `read: publishedOrAuthenticated` ensures:
  - Authenticated users see all content (draft, published, archived)
  - Anonymous users only see published content

This applies to all three collections: `courses`, `chapters`, and `lessons`.
