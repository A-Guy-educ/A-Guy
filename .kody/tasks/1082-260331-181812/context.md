
### taskify (2026-03-31T18:21:27)
Based on my exploration of the codebase, here's the task classification:

```json
{
  "task_type": "feature",
  "title": "Add course lessons sorter component to admin course edit",
  "description": "Add a custom admin component in the course edit view that displays all lessons grouped by chapters, with drag-and-drop and up/down button sorting that updates each lesson's order field. Should appear above the meta field.",
  "scope": [
    "src/server/payload/collections/Courses.ts",
    "src/ui/adm
...(truncated)

### plan (2026-03-31T18:21:58)
Now I have enough context. Here's my implementation plan:

---

## Plan: Course Lessons Sorter Component

### Step 1: Create the CourseLessonsSorter UI component
**File:** `src/ui/admin/CourseLessonsSorter/index.tsx`
**Change:** Create new component that:
- Uses `useDocumentInfo` to get current course ID
- Fetches chapters (sorted by `order`) then lessons per chapter (sorted by `order`)
- Groups lessons by chapter
- Renders sortable list with drag-handle + up/down buttons (same pattern as `Lesso
...(truncated)

### build (2026-03-31T18:29:34)
Implementation complete. Here's a summary of the changes:

## Changes Made

### 1. Created API Route
**File:** `src/app/api/lessons/[id]/route.ts`
- PATCH endpoint for updating lesson order
- Admin-only access via role check
- Validates order is a non-negative integer

### 2. Created CourseLessonsSorter Component
**File:** `src/ui/admin/CourseLessonsSorter/index.tsx`
- Uses `useDocumentInfo` to get current course ID
- Fetches chapters sorted by `order`, then lessons per chapter
- Groups lessons 
...(truncated)
