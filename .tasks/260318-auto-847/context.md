# Codebase Context: 260318-auto-847

## Files to Modify
- `src/ui/web/exerciserenderer/questions/McqQuestion/index.tsx` (line 116) — Add `text-lg` to option text container className
- `tests/unit/components/McqQuestion.test.tsx` (append new test) — Add test verifying `text-lg` class on option containers

## Files to Read (reference patterns)
- `src/ui/web/exerciserenderer/questions/McqQuestion/index.tsx` — Current MCQ component with option rendering
- `tests/unit/components/McqQuestion.test.tsx` — Existing test patterns (render setup, mockT helper, container queries)
- `src/app/(frontend)/globals.css` (lines 290–401) — `.rich-text-content` and `.katex` CSS rules for context on font sizing
- `src/ui/web/exerciserenderer/blocks/RichTextRenderer/index.tsx` — How RichTextRenderer applies `rich-text-content` class

## Key Signatures
- `export function McqQuestion({ question, answer, onChange, disabled, checkResult, t }: McqQuestionProps)` from `src/ui/web/exerciserenderer/questions/McqQuestion/index.tsx`
- `export function RichTextRenderer({ block }: RichTextRendererProps)` from `src/ui/web/exerciserenderer/blocks/RichTextRenderer/index.tsx`
- `cn(...inputs: ClassValue[]): string` from `@/infra/utils/ui`

## Reuse Inventory
- `cn()` from `@/infra/utils/ui` — already used in McqQuestion for conditional className assembly
- Tailwind `text-lg` utility — standard utility, 1.125rem/18px
- `mockT` helper from existing test — reuse for new test case
- `render`, `screen`, `cleanup` from `@testing-library/react` — already imported in test file

## Integration Points
- McqQuestion is rendered inside `ExerciseRenderer/index.tsx` (line 633) — no changes needed there
- The `text-lg` class only affects the option content wrapper, not the question prompt (which has its own `text-base` at line 67)
- `.rich-text-content .katex { font-size: 1.1em }` in globals.css means KaTeX will render at 1.1× the new 18px base = ~19.8px

## Imports Verified
- `@/ui/web/exerciserenderer/questions/McqQuestion` → exports McqQuestion ✅
- `@/infra/utils/ui` → exports cn ✅
- `@testing-library/react` → render, screen, cleanup, fireEvent ✅
- `vitest` → describe, it, expect, vi, beforeEach, afterEach ✅
