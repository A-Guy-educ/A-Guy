# Plan: Increase font size of MCQ answer options (260318-auto-847)

## Research Findings

- `src/ui/web/exerciserenderer/questions/McqQuestion/index.tsx` ✅ exists — Main MCQ question component
- `src/ui/web/exerciserenderer/blocks/RichTextRenderer/index.tsx` ✅ exists — Renders markdown + KaTeX
- `src/ui/web/shared/MathMarkdown/index.tsx` ✅ exists — Base markdown+math renderer
- `src/app/(frontend)/globals.css` ✅ exists — Contains `.rich-text-content` and `.katex` styles (lines 290–401)
- `tests/unit/components/McqQuestion.test.tsx` ✅ exists — Existing unit tests for McqQuestion
- `src/ui/web/exerciserenderer/answers/McqAnswerUI/index.tsx` ✅ exists — Deprecated legacy component (NOT used)

### Patterns Observed

- McqQuestion renders each option using `<RichTextRenderer>` which wraps content in a `<div class="rich-text-content leading-relaxed text-foreground">`
- The option text wrapper at line 116 is `<div className="flex-1 text-foreground">` — **no font-size class**
- The question prompt at line 67 uses `text-base font-medium` (16px)
- KaTeX math in `.rich-text-content .katex` is `font-size: 1.1em` (relative to parent)
- Since the option container has no explicit font size, it inherits the browser default (~16px for body text), and KaTeX renders at ~17.6px (1.1em of 16px) — too small for math expressions in answer options

### Integration Points

- The McqQuestion component is used inside ExerciseRenderer (line 633)
- The component is wrapped in a `QuestionCard` that doesn't set font size
- CSS changes in `globals.css` affect all `.rich-text-content` contexts, so option-specific sizing must be scoped

## Reuse Inventory

- **Existing**: `cn()` from `@/infra/utils/ui` — for conditional class merging ✅
- **Existing**: Tailwind `text-lg` class (18px / 1.125rem) — standard larger font ✅
- **Existing**: `rich-text-content` CSS class — already used by RichTextRenderer ✅
- **No new utilities needed** — this is purely a CSS/className fix

## Root Cause Analysis

The MCQ answer option text (`<div className="flex-1 text-foreground">` at McqQuestion line 116) has **no explicit font size**. It inherits the default body size (~16px). For mathematical expressions rendered by KaTeX, the effective size is only `1.1em` of 16px ≈ 17.6px. This is too small for comfortable reading of complex fractions and mathematical notation in an interactive selection context where the student needs to quickly scan and compare options.

The fix needs to:
1. Increase the base font size of MCQ option text to `text-lg` (18px), which makes KaTeX math render at ~19.8px
2. Scope the change to MCQ options only (not prompt text, not other rich-text-content contexts)

---

### Step 1: Increase font size on MCQ answer option text container

**Root Cause**: The `<div className="flex-1 text-foreground">` wrapper around each MCQ option's RichTextRenderer has no explicit font size class, causing answer options (especially math expressions) to appear too small.

**Files to Touch**:

- `src/ui/web/exerciserenderer/questions/McqQuestion/index.tsx` (MODIFIED — line 116)

**Change**: On line 116, change:
```tsx
<div className="flex-1 text-foreground">
```
to:
```tsx
<div className="flex-1 text-lg text-foreground">
```

This adds `text-lg` (1.125rem / 18px) which:
- Increases plain text in options from 16px → 18px
- Increases KaTeX math from ~17.6px → ~19.8px (via the 1.1em multiplier in globals.css)
- Is scoped only to the option content wrapper, not the prompt or instruction text

**Reproduction Test**: Write a test that verifies the MCQ option text container has the `text-lg` class.

- Test location: `tests/unit/components/McqQuestion.test.tsx`
- What it tests: Each MCQ option's text container should include the `text-lg` Tailwind class for larger font rendering
- Why it fails now: The current code renders `<div class="flex-1 text-foreground">` without `text-lg`

```
Test: 'MCQ option text container has text-lg class for readability'
- Render McqQuestion with options
- Query all option label containers for the text wrapper div (the flex-1 child of each label)
- Assert each wrapper's classList contains 'text-lg'
- FAILS before fix: class is "flex-1 text-foreground" (no text-lg)
- PASSES after fix: class is "flex-1 text-lg text-foreground"
```

**Fix**: Add `text-lg` to the className string on line 116.

**Verification**:

- Run `pnpm vitest run tests/unit/components/McqQuestion.test.tsx` → new test FAILS before fix, PASSES after
- Run existing tests → all PASS (no regression)
- Visual: MCQ options render with larger, more readable text and math expressions

**Acceptance Criteria**:

- [ ] MCQ option text wrapper has `text-lg` class
- [ ] All existing McqQuestion tests still pass
- [ ] New test verifies the `text-lg` class is present on option text containers
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm lint` passes
