# Doc update for PR #2154 rendering changes (issue #2250)

Updated `docs/exercises/README.md` to reflect PR #2154's rendering behavior changes.

## Changes made (this session)

1. **Key Features**: Added "Scroll View Rendering" bullet describing the scroll view card rendering.

2. **Architecture diagram**: Replaced the Zod schemas box with three new layers:
   - `BlocksDocumentLessonView` (Scroll View) — lesson-level renderer with Solutions section
   - `ExerciseWorksheet` — block-level renderer with card wrapping for geometry/axis
   - `GraphWithPrompt` — geometry/axis wrapper with dir=ltr, 3/5 wrap, worksheetLayout

3. **Geometry block description**: Added worksheet rendering notes — card wrapper (`rounded-xl border bg-card p-card-padding-sm`), 50/50 split, mobile prompt-first stacking, RTL via forced `dir="ltr"` on flex container.

4. **Axis block description**: Same as geometry — card wrapper, 50/50, 3/5 wrap, RTL-aware.

5. **Contributing section**: Fixed duplicate steps 4/5 (leftover from prior edit).
