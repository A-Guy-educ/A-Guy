# Issue #2534 — KaTeX strict-mode warnings for Hebrew Unicode chars

## What I did

**Root cause**: `MathMarkdown` uses `rehypeKatex` which calls KaTeX with its default `strict: "warn"` option. When Hebrew Unicode characters (e.g., ח, ז, ק, ה from "חזקות") appear inside math delimiters, KaTeX emits console warnings for each unrecognized character.

**Fix**: In `src/ui/web/shared/MathMarkdown/index.tsx`, changed:
```tsx
rehypePlugins={[rehypeKatex, rehypeMathWrapper]}
```
to:
```tsx
rehypePlugins={[[rehypeKatex, { strict: false }], rehypeMathWrapper]}
```

`rehype-katex` accepts `KatexOptions` (excluding `displayMode` and `throwOnError`) as its plugin options. Passing `strict: false` disables KaTeX's Unicode character warnings, which is appropriate for Hebrew math content.

**Test added**: Two new tests in `tests/unit/components/MathMarkdown.test.tsx` verify that Hebrew inside inline (`$...$`) and block (`$$...$$`) math delimiters does not emit KaTeX strict-mode `console.warn` calls. These tests failed before the fix (4 warnings each) and pass after.

**Scope**: This fix applies to all uses of `MathMarkdown` throughout the app (exercise content, chat, lesson duplication review, LatexDocumentViewer).
