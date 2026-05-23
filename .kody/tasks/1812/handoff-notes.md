## Issue #1812 Fix Summary

**Problem**: In ExerciseWorksheet, the question label circle (א, ב, ג etc.) appeared above the section text with a vertical gap (`mb-3` margin), instead of sharing the same horizontal line.

**Root cause**: `WorksheetQuestionLabel` only rendered the circle div. The text (`inner` content from `renderBlockContent`) was rendered as a separate sibling below it via a React fragment (`<><WorksheetQuestionLabel />{inner}</>`).

**Fix applied** (`src/ui/web/exerciserenderer/ExerciseWorksheet/index.tsx`):

1. Updated `WorksheetQuestionLabelProps` to accept optional `children?: React.ReactNode`
2. Updated `WorksheetQuestionLabel` to render `{children}` inside the same flex container (removed `mb-3` that created the vertical gap)
3. Updated `renderBlockWithLabel` to pass `inner` as children instead of a separate sibling:
   - Before: `<><WorksheetQuestionLabel ... />{inner}</>`
   - After: `<WorksheetQuestionLabel ...>{inner}</WorksheetQuestionLabel>`

**Result**: Label circle and text now share the same horizontal line via `flex items-center`, with proper RTL support (`flex-row-reverse` for RTL locale).
