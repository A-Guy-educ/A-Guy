# Plan: Add tests for context extraction → exercise conversion solution routing

## Context

PR branch: `fix/context-extraction-prompt-solution-separation` (commit 45cc9ccb)

Two files were changed in the conversion pipeline:
1. **`src/app/api/exercises/import-latex-ai/route.ts`** — `splitLatexIntoExercises` needs to be extracted for testability
2. **`src/app/api/lessons/create-context-exercises/route.ts`** — exercises with solutions stored as separate LaTeX blocks (exercise block + solution block)

---

## Step 1: Extract `splitLatexIntoExercises` to shared utility

**File:** `src/lib/latex-parser/split-exercises.ts` (new)

**Change:** Create a new utility file exporting `splitLatexIntoExercises`. This replaces the private function currently in the route file.

**Why:** Private functions in route files cannot be unit tested. Extracting to a dedicated utility makes it testable and reusable.

**Verify:** `pnpm typecheck` passes

---

## Step 2: Update import-latex-ai route to use the extracted utility

**File:** `src/app/api/exercises/import-latex-ai/route.ts`

**Change:** Remove the local `splitLatexIntoExercises` function (lines 479–512) and replace the call on line 52 with:
```typescript
import { splitLatexIntoExercises } from '@/lib/latex-parser/split-exercises'
```

**Verify:** `pnpm typecheck` passes

---

## Step 3: Write unit tests for `splitLatexIntoExercises`

**File:** `tests/unit/lib/latex-parser/split-exercises.spec.ts` (new)

**Tests (in order):**

1. **`\section*{פתרונות}` with numbered solutions** — LaTeX with `\section*{פתרונות}` followed by `\section*{פתרון תרגיל N}` for each exercise. Each exercise chunk should contain its matching solution section.

2. **Inline solutions** — Solution immediately after exercise content within the same chunk. Should stay combined as one block.

3. **No solutions** — Plain exercise LaTeX with no solution sections. Returns only exercise-only chunks.

4. **Mismatched solution numbers** — Exercise numbers 1,2,3 with only solutions for 1 and 3. Unmatched solutions should not break parsing.

5. **`\subsection*{פתרון שאלה N}` variant** — Alternative header format `\subsection*{פתרון שאלה N}`. Should be handled correctly.

6. **Preamble stripping** — `\documentclass`, `\usepackage`, `\begin{document}` before exercises should be stripped.

7. **Empty/no match** — LaTeX with no exercise headers should return the whole text as one chunk.

8. **Single exercise** — Exactly one exercise, no solutions. Returns one chunk.

**Verify:** `pnpm test:unit -- --run tests/unit/lib/latex-parser/split-exercises.spec.ts` passes

---

## Step 4: Write unit tests for combined LaTeX block format

**File:** `tests/unit/app/api/lessons/create-context-exercises/combined-latex-block.spec.ts` (new)

Tests verify the `makeLatexBlock` + conditional solution-block logic from the route:

1. **With solution** — `exercise.solution` is present → two LaTeX blocks created (exercise content + solution content)
2. **Without solution** — `exercise.solution` is null → one LaTeX block (exercise only)
3. **Solution includes `\section*{פתרון}` header** — verifies the parsed solution from `parseContextText` already contains the solution header

**Verify:** `pnpm test:unit -- --run tests/unit/app/api/lessons/create-context-exercises/combined-latex-block.spec.ts` passes

---

## Step 5: Update parser-gaps test with solution round-trip

**File:** `tests/unit/lib/context-exercise-parser/parser-gaps.test.ts`

**Add:** New `describe('solution round-trip through create-context-exercises')` block with:

1. **Exercises with solutions round-trip correctly** — Parse LaTeX with both exercises and solutions, verify each `ParsedExercise.solution !== null` and `ParsedExercise.solutionHeader` is set
2. **Exercises without solutions round-trip correctly** — Verify `solution === null` for exercise-only LaTeX
3. **LaTeX block construction for solution exercises** — Given a `ParsedExercise` with a solution, construct `blocks = [makeLatexBlock(exercise.latexContent), makeLatexBlock(exercise.solution)]` and verify block count = 2 and block types

**Verify:** `pnpm test:unit -- --run tests/unit/lib/context-exercise-parser/parser-gaps.test.ts` passes

---

## Step 6: Final verification

Run all quality gates:
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test:unit`

---

## Files summary

| Action | File |
|--------|------|
| **Create** | `src/lib/latex-parser/split-exercises.ts` |
| **Create** | `tests/unit/lib/latex-parser/split-exercises.spec.ts` |
| **Create** | `tests/unit/app/api/lessons/create-context-exercises/combined-latex-block.spec.ts` |
| **Modify** | `src/app/api/exercises/import-latex-ai/route.ts` (remove local fn, add import) |
| **Modify** | `tests/unit/lib/context-exercise-parser/parser-gaps.test.ts` (add round-trip block) |
