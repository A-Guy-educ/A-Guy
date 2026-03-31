
### taskify (2026-03-31T18:16:25)
{
  "task_type": "feature",
  "title": "Add edit and delete buttons to Lesson Blocks",
  "description": "Add trash icon to delete a block from the lesson and edit icon to navigate to the admin edit page for exercises and content pages in the Lesson Blocks field component.",
  "scope": [
    "src/ui/admin/LessonBlocksField/index.tsx"
  ],
  "risk_level": "medium",
  "questions": []
}


### plan (2026-03-31T18:16:47)
## Plan

**Step 1: Add edit and delete buttons to LessonBlocksField**

**File:** `src/ui/admin/LessonBlocksField/index.tsx`
**Change:** 
- Import `Trash2` and `Pencil` icons from `lucide-react`
- Import `useRouter` from `next/navigation`
- Add `deleteBlock` callback that removes a block by index using immutable pattern
- Add edit button (Pencil icon) that navigates to `/admin/collections/exercises/${id}` or `/admin/collections/content-pages/${id}` based on blockType
- Add delete button (Trash2 i
...(truncated)

### build (2026-03-31T18:18:09)
Implementation complete. Changes made to `src/ui/admin/LessonBlocksField/index.tsx`:

1. **Added imports**: `useRouter` from `next/navigation`, `Trash2` and `Pencil` icons from `lucide-react`

2. **Added `deleteBlock` callback** (lines 199-206): Removes a block by index using immutable pattern (`[...blocks]`)

3. **Added `editBlock` callback** (lines 208-214): Navigates to `/admin/collections/exercises/${id}` or `/admin/collections/content-pages/${id}` based on blockType

4. **Added buttons** (l
...(truncated)

### review (2026-03-31T18:20:32)
## Verdict: PASS

## Summary

Added edit (Pencil) and delete (Trash2) buttons to the `LessonBlocksField` component with `deleteBlock` and `editBlock` callbacks following immutable patterns. The edit button navigates to the appropriate admin collection URL based on block type.

## Findings

### Critical

None.

### Major

None.

### Minor

- `src/ui/admin/LessonBlocksField/index.tsx:295` — `rows.map` uses filtered `refId` index, but drag handlers pass `idx` from `blocks.map` (unfiltered). After d
...(truncated)
