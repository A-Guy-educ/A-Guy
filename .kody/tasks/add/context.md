
### build (2026-04-04T18:06:09)
All good. Here's what was implemented:

---

### Changes

**`src/app/api/chapters/reorder/route.ts`** (new)
- Admin-only POST endpoint supporting two modes:
  - `{ id, direction }` — move a single chapter up or down within its course, then rebalance all sibling `order` values to `1, 2, 3…`
  - `{ courseId, orderedIds }` — bulk reorder after drag-and-drop, sets `order` for each ID in the provided sequence

**`src/ui/admin/ChapterOrderCell/index.tsx`** (new)
- Custom cell component for the `order`
...(truncated)

### review (2026-04-04T18:10:28)
Now I have enough context. Here's my structured review:

---

## Verdict: FAIL

## Summary

Adds chapter reorder functionality (up/down arrows + drag-and-drop modal) to the Chapters admin list view via a new API route and two new admin components. The implementation has a data integrity vulnerability in the bulk reorder endpoint and a performance issue in the drag list.

## Findings

### Critical

1. `src/app/api/chapters/reorder/route.ts:40-50` — **Bulk reorder does not verify that `orderedIds`
...(truncated)

### review-fix (2026-04-04T18:13:35)
Clean. All critical and major issues are fixed:

**Critical fixes:**
- `route.ts`: Added Zod schemas (`bulkReorderSchema`, `singleMoveSchema`) validating all input fields with proper types
- `route.ts`: Bulk reorder now fetches all chapters for `courseId` first and verifies `orderedIds` is an exact permutation — rejects if any ID doesn't belong to the course or if the count doesn't match

**Major fixes:**
- `route.ts`: Single-move mode now re-reads both affected chapters after writing and return
...(truncated)

### review (2026-04-04T18:16:15)
Noted — the dev server background process completed (it was already killed). The review is complete as posted above.


### review-fix (2026-04-04T18:27:58)
Browser verification is complete. Here's the summary:

**All fixes verified — UI is working correctly:**

- **Sort Chapters button**: Appears above the chapters list with hint text "Filter by course first, then drag to reorder"
- **Order column cells**: Show the order number with ↑ ↓ arrow buttons in every row (e.g., "1 ↑ ↓")
- **Sort Chapters modal**: Opens correctly, shows a "Please filter the list by a specific course before sorting" guard message when no course filter is applied, with Save O
...(truncated)
