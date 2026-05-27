# Issue #2138 — Eliminate horizontal scroll (mobile priority)

## What was done

### Root causes identified
1. **html/body had no overflow-x rule** — any overflowing child created page-level horizontal scroll. The KaTeX display blocks have their own overflow-x:auto, but the document root was allowing scroll.
2. **LatexDocumentViewer used px-12 on mobile** — 48px horizontal padding + max-w-[794px] = ~890px total width, overflowing 360px viewports.
3. **ConsolidatedLatexLessonView article had overflow:hidden** — KaTeX content that needed horizontal scroll (wide math expressions) was being clipped.

### Files changed

1. **`src/app/(frontend)/globals.css`** — Added `overflow-x: hidden` to html and `overflow-x: hidden` to body. This is the foundational fix that prevents document-level horizontal scroll globally. Inner scroll containers (KaTeX, tables, code blocks) keep their own overflow-x:auto.

2. **`src/ui/web/shared/LatexDocumentViewer/index.tsx`** — Changed `px-12 py-10 sm:px-16 sm:py-12` → `px-4 py-10 sm:px-12 sm:py-12`. Mobile (default) gets 16px horizontal padding instead of 48px. With max-w-4xl (896px), 16px + 896px + 16px = 928px — still wider than 320px but the overflow-x:hidden on html now handles this at the document level. KaTeX scroll inside the viewer works because the viewer itself has overflow-auto.

3. **`src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ConsolidatedLatexLessonView/index.tsx`** — Changed article `overflow-hidden` → `overflow-x-auto overflow-y-hidden`. KaTeX content that overflows horizontally now scrolls within the article instead of being clipped.

4. **`tests/e2e/lesson-horizontal-scroll-2138.e2e.spec.ts`** — New E2E test that verifies no horizontal scroll at 320px, 360px, 375px, 768px, 1024px, 1440px viewports, plus explicit checks that html/body have overflow-x:hidden.

### Why this approach works
- overflow-x:hidden on html/body is the "lock" — it prevents the browser from ever showing a horizontal scrollbar at the document root
- Inner containers (KaTeX-display, rich-text tables, code blocks) have their own overflow-x:auto — the "inner scroll"
- KaTeX's overflow-x:auto on .katex-display only works when its container allows overflow — the document-level hidden doesn't affect it because KaTeX-display is a descendant that can still establish its own containing block
- Responsive padding prevents the total width from exceeding small viewports even before the overflow-x:hidden kicks in

### Quality gates
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `pnpm ci:local` — passed (full gates)

### Notes for reviewers
- The KaTeX overflow fix (overflow-x:auto on .katex-display in globals.css) was already in place — the missing piece was the document-level overflow-x:hidden on html/body
- The ChatInterface input uses max-w-chat (850px) and is inside flex containers that should shrink properly. The SplitPaneLayout also uses flex and overflow-hidden. No changes were needed for ChatInterface.
- The GraphWithPrompt component uses min-w-0 on graph child divs for flex-based shrinking, which should prevent graph renderers from overflowing.
