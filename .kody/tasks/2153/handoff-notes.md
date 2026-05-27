# PR #2153 — Fix round 2: remaining horizontal scroll gaps on mobile

## What was fixed

Two gaps remained after the initial overflow-x:hidden fix:

### Gap 1: LatexDocumentViewer overflow-visible bypasses scroll container
The LatexDocumentViewer had `overflow-visible` which let KaTeX content overflow out of the rounded card corners instead of scrolling within the article's `overflow-x-auto` container. Changed to `overflow-x-auto overflow-y-hidden` so wide content scrolls inside the card while vertical overflow is still hidden.

### Gap 2: Card header and footer use fixed px-12 on mobile
The article header (line 41) and footer (line 58) used `px-12` (48px per side) which overflows at 320-360px viewports. Both changed to `px-4 sm:px-12` — 16px on mobile, 48px on sm+ — matching the LatexDocumentViewer padding fix from the initial PR.

## Files changed

- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ConsolidatedLatexLessonView/index.tsx` — three targeted className edits only.

## How the fix works

The article now has `overflow-x-auto` wrapping the LatexDocumentViewer which has `overflow-x-auto overflow-y-hidden`. This means:
- KaTeX/math content wider than the viewport scrolls horizontally within the card
- The card corners clip vertical overflow (no content bleeding outside rounded borders)
- Mobile header/footer padding no longer causes overflow at 320-360px
