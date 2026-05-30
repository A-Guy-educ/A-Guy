# Fix for #2139 RTL exercise layout (bug fixes from PR #2154 review)

## What was fixed

### Bug 1 — sideBySideLayout ternary inverted (line 88)
- Changed: `isRtl ? 'textRight' : 'textLeft'` → `isRtl ? 'textLeft' : 'textRight'`
- The previous mapping caused RTL graphs to render on the wrong side because GraphWithPrompt's `showGraphFirst` logic and WorksheetQuestionLabel's `flex-row-reverse` combined to flip positions incorrectly.
- The new mapping: LTR→`textRight` (graph first in DOM, appears left), RTL→`textLeft` (prompt first in DOM, `flex-row-reverse` flips to graph-left, text-right).

### Bug 2 — Hebrew badge stranded below figure (question_geometry / question_axis)
- Removed `question_geometry` and `question_axis` from `LABELLED_QUESTION_TYPES` set.
- Added explicit handling in `renderBlockWithLabel` for these two types:
  - `WorksheetQuestionLabel` wraps only the badge + `PromptText` (no `GraphWithPrompt` inside).
  - `GraphWithPrompt` (with card-wrapped diagram) renders as a sibling below the badge+text row.
  - This ensures the badge aligns beside the question text, not beside or below the full-width diagram.

### Bug 3 — Card wrapper missing in exerciseworksheet path
- Added `<div className="my-4 rounded-xl border bg-card p-4">` wrapping `<GeometryRenderer>` and `<AxisRenderer>` inside `GraphWithPrompt.children`.
- Previously the card wrapper was only applied in `LatexDocumentViewer`'s `DiagramRenderer` path — exercises use `ExerciseWorksheet` which never reached that path.

## Key interaction: prompt rendering deduplication
- In the new geometry/axis structure, `PromptText` renders the question text once inside `WorksheetQuestionLabel`.
- To prevent double-rendering of the prompt text inside `GraphWithPrompt`, `prompt={undefined}` is passed to `GraphWithPrompt` in these two cases (the prompt is already shown in the label row).
- This avoids `getByText` finding the prompt text twice in tests.
