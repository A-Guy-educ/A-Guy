## Plan

**Step 1: Add edit and delete buttons to LessonBlocksField**

**File:** `src/ui/admin/LessonBlocksField/index.tsx`
**Change:** 
- Import `Trash2` and `Pencil` icons from `lucide-react`
- Import `useRouter` from `next/navigation`
- Add `deleteBlock` callback that removes a block by index using immutable pattern
- Add edit button (Pencil icon) that navigates to `/admin/collections/exercises/${id}` or `/admin/collections/content-pages/${id}` based on blockType
- Add delete button (Trash2 icon) that calls `deleteBlock(row.index)`
- Place both buttons after the move buttons, with matching button styles
**Why:** Matches existing admin UI patterns and fulfills the feature request
**Verify:** `pnpm typecheck` passes

---

**No Questions** — implementation is straightforward following existing patterns.
