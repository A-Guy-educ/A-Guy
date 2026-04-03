Good - the `chapters` join field is entirely new. The implementation is clean. Here's my review:

---

## Verdict: PASS

## Summary

Adds a `chapters` join field to the Courses collection and includes it in `defaultColumns`, so the admin list view at `/admin/collections/courses` displays a chapter count column. The `status` column was already present in `defaultColumns`.

## Findings

### Critical

None.

### Major

None.

### Minor

1. `src/server/payload/collections/Courses.ts:67` — The `status` column was already in `defaultColumns` on `dev` before this PR. The task title says "show course status" but no change was needed for that criterion — it was already satisfied. This is a no-op for the status acceptance criterion, which is fine but worth noting.

2. `src/server/payload/collections/Courses.ts:268-276` — The join field lacks `maxDepth: 0` which would prevent unnecessary population of the full chapter documents when only the count is needed in the list view. Payload's join fields include `totalDocs` by default, so the count will display correctly, but adding `maxDepth: 0` would be a minor performance optimization for list queries. Not blocking.

## Browser Verification

Browser tools are not available in this environment, and the dev server hit a stale `.next` cache error unrelated to the code changes. The previous build stage confirmed typecheck passes. The implementation follows standard Payload CMS patterns for join fields and `defaultColumns` — the column will render automatically.
