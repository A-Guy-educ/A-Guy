# PR #2153 — Merge conflict resolution with dev

## Task: Resolve git merge conflict from `git merge origin/dev`

### Conflicted file: `.kody/last-run.jsonl`
This is a session log file (JSONL). Both HEAD and origin/dev had different session logs:
- **HEAD**: 75 lines, session_id `d248d67d...`
- **origin/dev**: 133 lines, session_id `86afddb9...` (more complete)

**Resolution**: Took the origin/dev version (133-line session log) as it represents the more recent and complete session. The file was validated as correct JSONL after resolution.

**Note**: All other source code files had no conflicts. The conflict markers found by grep in this file were all literal text inside JSON string values (session log descriptions), not actual git conflict markers.

---

## Previous handoff (round 3, pre-merge):

### globals.css: html and body overflow-x hidden
`html` element (line ~261) and `body` element (line ~207) were missing `overflow-x: hidden`. Added to both:
```css
html {
  overflow-x: hidden;
}
body {
  overflow-x: hidden;
}
```
This is the foundational fix — prevents document-level horizontal scroll even when child elements overflow.

### globals.css: table overflow-x-auto
The `table` element (line ~414) was missing `overflow-x: auto`. Added:
```css
table {
  overflow-x: auto;
  /* existing: width: 100%; table-layout: fixed; word-break: break-word; */
}
```
Tables now scroll horizontally before overflowing their container.

### JSXGraphBoard container style fix
Container style changed from:
```jsx
style={{ width: '100%', aspectRatio: `${width} / ${height}` }}
```
To:
```jsx
style={boardDimensions.width === 0 ? undefined : { width: boardDimensions.width, height: boardDimensions.height }}
```
The `aspectRatio` approach caused JSXGraphBoard to read a different clientWidth than the CSS-constrained container size, leading to mismatched board/sVG dimensions. The new approach uses ResizeObserver-measured `boardDimensions` directly, and falls back to no explicit style (w-full from className handles it) when dimensions are 0 (initial state before JSXGraphBoard reads container).

---

## Previous rounds (documented for context)

### Round 2 (prior kody session)
- JSXGraphBoard ResizeObserver for proportional mobile scaling
- LatexDocumentViewer `max-w-full sm:max-w-4xl` for responsive containment
- JXGBoard.resize() type declaration added

### Round 1 (initial PR)
- `overflow-x: hidden` on html/body (this was the main fix — added in round 3)
- LatexDocumentViewer responsive padding `px-4 sm:px-12`
- ConsolidatedLatexLessonView article `overflow-x-auto`
- KaTeX `.katex-display overflow-x-auto` (already present)

## Items addressed before round 3
- Images: `max-width: 100%; width: 100%` already in globals.css
- Tables: `width: 100%; word-break: break-word` already in globals.css
- SplitPaneLayout: primary content container has `overflow-hidden`

## Quality gates
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `pnpm ci:local` — passed
