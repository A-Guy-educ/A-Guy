**Root Cause**: When Payload's admin UI fetches chapters for the relationship dropdown, it sends `select: { adminTitle: true }`. This means:

1. The API returns docs with only `id` and `adminTitle` fields
2. `title` and `course` fields are **stripped** from the doc before the collection-level `afterRead` hook runs
3. The `computeAdminTitleOnRead` hook checks `doc.title` (line 21) — but it's `undefined` because it was stripped by `select`
4. So for chapters where `adminTitle` is `null` in the DB, the hook bails and returns without setting it
5. `formatDocTitle` sees `data.adminTitle` is falsy → shows "untitled - ID: [id]"

---

# Rerun Feedback (iteration 1) - 2026-02-16T12:11:19.024Z

## Issues Found

fix broke the dropdown chapter names, now they are broken, instead of name it shows: untitled - ID: [id]

## Action Required

The architect agent should address these issues in the re-run.
