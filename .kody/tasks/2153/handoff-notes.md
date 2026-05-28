# PR #2153 — Fix round 2: remaining horizontal scroll gaps on mobile

## Previous round (rounded 2)
Two gaps remained after the initial overflow-x:hidden fix:

### Gap 1: LatexDocumentViewer overflow-visible bypasses scroll container
The LatexDocumentViewer had `overflow-visible` which let KaTeX content overflow out of the rounded card corners instead of scrolling within the article's `overflow-x-auto` container. Changed to `overflow-x-auto overflow-y-hidden` so wide content scrolls inside the card while vertical overflow is still hidden.

### Gap 2: Card header and footer use fixed px-12 on mobile
The article header (line 41) and footer (line 58) used `px-12` (48px per side) which overflows at 320-360px viewports. Both changed to `px-4 sm:px-12` — 16px on mobile, 48px on sm+ — matching the LatexDocumentViewer padding fix from the initial PR.

---

## This round (round 3): Feedback-driven JSXGraphBoard and LatexDocumentViewer fixes

### JSXGraphBoard: ResizeObserver for proportional scaling
The JSXGraphBoard container was using `w-full` + `maxWidth: '100%'` but the `width`/`height` props were completely ignored (renamed to `_width`/`_height`). JSXGraph reads the container element size at init time, so if the container had no explicit dimensions, the board could be incorrectly sized.

**Fix**: Added ResizeObserver to JSXGraphBoard that:
1. Measures the container's actual `clientWidth` on mount and on resize
2. Calculates scaled dimensions: `Math.min(originalWidth, measuredWidth)` for width, proportional height via aspect ratio
3. Updates state → triggers `board.resizeContainer(width, height)` to resize the JSXGraph SVG

Container div changed from `style={{ maxWidth: '100%' }}` to `style={{ width: '100%', aspectRatio: '${width} / ${height}' }}` — this gives the container an intrinsic aspect ratio so it doesn't collapse before JSXGraph measures it.

Also added `resize(width, height): void` method to `JXGBoard` interface in `src/types/jsxgraph.d.ts`.

### LatexDocumentViewer: responsive max-w-full on mobile
Outer div had `max-w-4xl` which doesn't cap at viewport width on mobile. Changed to `max-w-full sm:max-w-4xl` so it never overflows on small screens.

### Items already addressed before this round
- Images: `img { max-width: 100%; width: 100% }` already in globals.css (line ~407)
- Tables: `width: 100%; word-break: break-word; overflow-wrap: break-word` already in globals.css (line ~414)
- AxisRenderer: Already uses ResizeObserver + ResizeObserver pattern, passing scaled dimensions to JSXGraphBoard

## Quality gates
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `pnpm ci:local` — passed
