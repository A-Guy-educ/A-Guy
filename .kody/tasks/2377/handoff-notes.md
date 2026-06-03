# Fix for #2377: Courses Storefront Empty State Mismatch

## Root Cause
The `queryPublishedCourses` function was applying `status: published` filter unconditionally, but the collection's read access control (`publishedAndActive`) allows all courses for authenticated users. This created a mismatch where authenticated users could access draft courses via URL/admin but not see them on the `/courses` storefront listing.

## Fix Applied
Modified `src/server/repos/queries/courses.ts`:
- `queryPublishedCourses`: Now checks if user is authenticated via `payload.auth({ headers })`. For authenticated users, the `status: published` filter is NOT applied. For anonymous users, it remains (matching original behavior).
- `queryCourseBySlug`: Same treatment for consistency.

## Key Code Change
```typescript
// Check if user is authenticated
let user = null
try {
  const { headers: headersModule } = await import('next/headers')
  const { user: authUser } = await (payload as any).auth({ headers: await headersModule() })
  user = authUser
} catch {
  user = null
}

// Only apply status=published filter for anonymous users
const conditions: Where[] = [
  ...(isAuthenticated ? [] : [{ status: { equals: 'published' } }]),
  { isActive: { equals: true } },
  // ... rest of conditions
]
```

## Tests
- Created `tests/int/courses-storefront-visibility.int.spec.ts` with 6 tests
- All tests pass including the bug reproduction test for draft courses

## What Could Regress
- Anonymous users should still only see published courses (no change to their behavior)
- Draft courses now appear for authenticated users on the /courses listing
- The `contentStatus` filtering (for soon/visible) remains unchanged for both auth levels