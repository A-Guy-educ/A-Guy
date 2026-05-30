# Block Management Feature - Issue #1764

## What was implemented

Enhanced `ExerciseContentEditor` (`src/ui/admin/ExerciseContentEditor/index.tsx`) with:

1. **Drag-and-drop reordering**: Blocks now have drag handles (GripVertical icon) and support native HTML5 drag-and-drop. Visual feedback includes opacity reduction during drag and border highlight on drop target.

2. **Between-block add buttons**: Small circular `+` buttons appear between blocks on hover, allowing insertion at any position. The `handleAddBlock(index)` now inserts at `index + 1` position.

3. **Delete confirmation dialog**: Clicking delete shows a modal confirmation. If only one block exists, shows a warning that last block cannot be deleted.

4. **Simplified block header**: Removed up/down arrow buttons from block headers (replaced by drag handles) but kept duplicate and delete buttons.

5. **CSS**: Added styles for drag handles, drop target highlight, between-block add buttons, and delete confirmation dialog overlay.

## Key changes to index.tsx
- Added drag-and-drop state: `dragIndex`, `dropTarget`, `blocksRef`
- Added drag handlers: `handleDragStart`, `handleDragOver`, `handleDragLeave`, `handleDrop`, `handleDragEnd`
- Added delete confirmation: `confirmDeleteBlock`, `handleConfirmDelete`, `handleCancelDelete`
- Updated `BlockListProps` interface and `BlockList` component
- Updated `ContentBlockHeader` to only have duplicate/delete (no move buttons)
- Updated `renderQuestionEditor` to accept `canMoveUp`/`canMoveDown` params

## Key changes to index.css
- `.block-item--dragging`, `.block-item--drop-target` for drag visual feedback
- `.block-drag-handle` for grip icon (opacity 0, shows on hover)
- `.between-block-add-button` for the small circular add buttons
- `.delete-confirm-overlay`, `.delete-confirm-modal` for confirmation dialog

## Follow-up needed
- Add `beforeunload` event handler for unsaved changes warning (mentioned in issue but not implemented)

## Files
- `src/ui/admin/ExerciseContentEditor/index.tsx` - Main component
- `src/ui/admin/ExerciseContentEditor/index.css` - CSS additions
