
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
