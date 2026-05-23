# CI Fix: LessonExerciseEditor — Missing index.tsx Re-export

## What was failing

The CI Build step failed with:
```
Module not found: Can't resolve '@/ui/admin/LessonExerciseEditor'
```

The `importMap.js` imports from `@/ui/admin/LessonExerciseEditor` (resolving to the directory), but the directory only contained `LessonExerciseEditor.tsx` — no `index.tsx` to re-export it.

## Root cause

When the new `LessonExerciseEditor` component was created, the directory was set up as:
- `LessonExerciseEditor/LessonExerciseEditor.tsx` — the component
- `LessonExerciseEditor/index.css` — styles

But it was missing `LessonExerciseEditor/index.tsx` — the re-export file that all other admin components in this project have (e.g., `LessonBlocksField/index.tsx`).

## Fix

Created `src/ui/admin/LessonExerciseEditor/index.tsx` with:
```tsx
export { LessonExerciseEditor } from './LessonExerciseEditor'
```

This follows the same pattern used by every other admin component in `src/ui/admin/`.
