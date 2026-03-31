Now I have enough context. Here's my implementation plan:

---

## Plan: Course Lessons Sorter Component

### Step 1: Create the CourseLessonsSorter UI component
**File:** `src/ui/admin/CourseLessonsSorter/index.tsx`
**Change:** Create new component that:
- Uses `useDocumentInfo` to get current course ID
- Fetches chapters (sorted by `order`) then lessons per chapter (sorted by `order`)
- Groups lessons by chapter
- Renders sortable list with drag-handle + up/down buttons (same pattern as `LessonBlocksField`)
- On sort, calls `fetch('/api/lessons/${id}', { method: 'PATCH', body: JSON.stringify({ order: newOrder }) })` to persist

**Verify:** Component compiles without errors — `pnpm typecheck`

---

### Step 2: Register component in Courses collection
**File:** `src/server/payload/collections/Courses.ts`
**Change:** Add a `type: 'ui'` field above the `meta` group:
```typescript
{
  name: 'lessonsSorter',
  type: 'ui',
  admin: {
    components: {
      Field: '@/ui/admin/CourseLessonsSorter#CourseLessonsSorter',
    },
  },
},
```

**Verify:** `pnpm generate:types && pnpm generate:importmap`

---

### Step 3: Verify build
**Command:** `pnpm build` (or `pnpm dev` to test manually)

---

### Questions

- **Bulk reindexing:** The task mentions "currently most lessons sorting index is 0" — should the component also include a "Rebuild Order Index" button that assigns sequential order values (1, 2, 3...) to all lessons within a chapter?
