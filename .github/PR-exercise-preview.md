# Add Exercise Preview to Admin Sidebar

## Summary

Adds a "View Exercise" link in the Payload CMS admin sidebar that opens the exercise preview in the web frontend with the full design system.

## Changes

### New component: `src/ui/admin/ExercisePreview/index.tsx`

UI field component that:

- Links to `/exercises/{id}` for saved exercises
- Shows "Add content blocks to enable preview" when no content
- Shows "Save the exercise to preview it" for unsaved drafts

### Collection update: `src/server/payload/collections/Exercises/index.ts`

- Added `preview` field with `type: 'ui'` in sidebar
- Uses the ExercisePreview component

### Auto-generated: `src/app/(payload)/admin/importMap.js`

- Updated with ExercisePreview import

## Behavior

| State           | UI                                                        |
| --------------- | --------------------------------------------------------- |
| Saved exercises | Shows "View Exercise" button linking to `/exercises/{id}` |
| Unsaved drafts  | Shows "Save the exercise to preview it" message           |
| No content      | Shows "Add content blocks to enable preview" message      |

The preview opens in a new tab, allowing editors to see the exercise with the full web design system (Tailwind, components, etc.).

## Files Changed

```
M src/app/(payload)/admin/importMap.js
M src/server/payload/collections/Exercises/index.ts
A src/ui/admin/ExercisePreview/index.tsx
```
