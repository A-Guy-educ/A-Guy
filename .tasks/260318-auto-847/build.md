# Build Agent Report: 260318-auto-847

## Changes

- **`src/ui/web/exerciserenderer/questions/McqQuestion/index.tsx`** — Added `text-lg` class to the MCQ option text container (line 116). This increases the base font size from ~16px to 18px for answer options, making KaTeX math expressions render at ~19.8px (via the 1.1em multiplier in globals.css). This is scoped only to answer options, not the question prompt.

- **`tests/unit/components/McqQuestion.test.tsx`** — Added new test suite "Font size for answer options" with two test cases:
  - Verifies option text wrappers have `text-lg` class
  - Verifies prompt text does NOT have `text-lg` (uses `text-base`)

## Tests Written

- `tests/unit/components/McqQuestion.test.tsx` — 2 new tests in "Font size for answer options" describe block:
  - "renders option text with text-lg class for better readability"
  - "does not apply text-lg to the prompt text"

## Deviations

None — plan followed exactly.

## Quality

- TypeScript: PASS (`pnpm tsc --noEmit`)
- Lint: PASS (`pnpm lint`)
- Unit Tests: PASS (`pnpm test:unit` - 15 tests in McqQuestion.test.tsx, including 2 new ones)

## Bug Fix Verification

This is a **fix_bug** task. The bug was that MCQ answer options (especially mathematical expressions rendered via KaTeX) appeared too small for comfortable reading. The fix adds `text-lg` (18px base font size) to the option text container, which:
- Increases plain text options from 16px → 18px
- Increases KaTeX math rendering from ~17.6px → ~19.8px (via 1.1em multiplier)
- Is scoped only to answer options, not the question prompt

The new tests verify that:
1. The `text-lg` class is present on all option text containers
2. The prompt text remains unaffected (uses `text-base`)
