## Issue #1767 — No horizontal scroll in any lesson display mode

### What was done
Fixed horizontal overflow in all lesson display modes by applying 5 targeted CSS/class changes:

1. **`globals.css` `.rich-text-content table`** — Added `overflow-x: auto` so wide tables scroll internally instead of causing page-level scroll. Pattern mirrors the existing `.katex-display { overflow-x: auto }` in the same file.

2. **`BlocksDocumentLessonView/index.tsx`** — Added `max-w-full overflow-hidden` to the `<td>` cell containing lesson content, preventing inner content from overflowing the table.

3. **`LessonContent.tsx`** — Added `max-w-full` alongside `w-full` on `MediaComponent` so attached media files respect container width on mobile.

4. **`MediaTabContent/index.tsx`** — Added `max-w-full` alongside `w-full h-full` on `MediaComponent` for the same constraint in the Media tab.

5. **`SplitPaneLayout`** — No changes needed; all root divs already had `overflow-hidden` which clips horizontal overflow.

### Files touched
- `src/app/(frontend)/globals.css` — table overflow fix
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/BlocksDocumentLessonView/index.tsx` — td overflow fix
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/LessonContent.tsx` — MediaComponent max-w-full
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/MediaTabContent/index.tsx` — MediaComponent max-w-full
- `tests/e2e/lesson-horizontal-scroll.e2e.spec.ts` — new E2E test covering 320px, 375px, 768px, 1024px, 1440px viewports across all tabs

### Root cause
Tables in `.rich-text-content` had no overflow constraint — `w-full` gives width but doesn't prevent overflow. Media components lacked `max-w-full` to constrain them to container width on small viewports.

### Verification
Quality gates (typecheck, lint, tests) all green on first attempt.
