# Add tests for context extraction → exercise conversion solution routing

## Context

PR branch: `fix/context-extraction-prompt-solution-separation` (commit 45cc9ccb)

The conversion pipeline was dropping or misplacing solutions during LaTeX → interactive exercise conversion. Two files were changed:

1. **`src/app/api/exercises/import-latex-ai/route.ts`** — Updated the AI prompt to place solutions inside question block `solution` fields instead of skipping them. Fixed `splitLatexIntoExercises` to attach solution sections to their matching exercise chunks.
2. **`src/app/api/lessons/create-context-exercises/route.ts`** — Combined exercise + solution into a single LaTeX block (with `\section*{פתרון}` header) so downstream conversion sees them together.

## Tasks

### 1. Unit tests for `splitLatexIntoExercises`

Add tests in `tests/unit/app/api/exercises/import-latex-ai/` (or similar) covering:

- LaTeX with separate solutions section (`\section*{פתרונות}` followed by `\section*{פתרון תרגיל N}`) — solutions should be attached to matching exercise chunks
- LaTeX with inline solutions (solution immediately after exercise) — should stay combined
- LaTeX with no solutions — should return exercise-only chunks
- LaTeX with mismatched solution numbers — unmatched solutions should not break anything
- LaTeX with `\subsection*{פתרון שאלה N}` variant headers

Note: `splitLatexIntoExercises` is currently a private function in the route file. Extract it to a shared utility (e.g., `src/lib/latex-parser/split-exercises.ts`) so it can be unit tested.

### 2. Unit tests for create-context-exercises solution combining

Add tests verifying:
- When `exercise.solution` exists, the LaTeX block contains both exercise content and solution with proper `\section*{פתרון}` header
- When `exercise.solution` is null, only exercise content is in the block
- The combined format matches what the AI import prompt expects

### 3. Update existing parser-gaps tests

In `tests/unit/lib/context-exercise-parser/parser-gaps.test.ts` — add test cases that verify parsed exercises with solutions round-trip correctly through the create-context-exercises flow (combined block format).

### 4. Documentation

Update any relevant docs (inline JSDoc on changed functions) to document:
- The solution routing contract: solutions go in question block `solution` field, never as separate blocks
- The combined LaTeX block format used between Step 4 and Step 5

## Key files

- `src/app/api/exercises/import-latex-ai/route.ts` (changed)
- `src/app/api/lessons/create-context-exercises/route.ts` (changed)
- `tests/unit/lib/context-exercise-parser/parser-gaps.test.ts` (existing, extend)
- `tests/unit/server/services/lesson-context-conversion/context-extractions.test.ts` (existing, reference)

## Acceptance criteria

- [ ] `splitLatexIntoExercises` is extracted and has unit tests
- [ ] Combined LaTeX block format has unit tests
- [ ] All new tests pass (`pnpm test`)
- [ ] Typecheck passes (`pnpm typecheck`)

---

## Discussion (10 comments)

**@yaeliavni** (2026-04-19):
@kody

**@aguyaharonyair** (2026-04-19):
🚀 Kody pipeline started: `1279-260419-095607` ([logs](https://github.com/A-Guy-educ/A-Guy/actions/runs/24626368686))

**@aguyaharonyair** (2026-04-19):
🤖 Job manager picked up this issue. I will drive it to a PR and comment again when done or if I hit a blocker.

@kody full

**@aguyaharonyair** (2026-04-19):
🤖 Job manager picked up this issue. I will drive it to a PR and comment again when done or if I hit a blocker.

@kody full

**@aguyaharonyair** (2026-04-19):
🤖 Job manager picked up this issue. I will drive it to a PR and comment again when done or if I hit a blocker.

@kody full

**@aguyaharonyair** (2026-04-19):
🤖 Job manager picked up this issue. I will drive it to a PR and comment again when done or if I hit a blocker.

@kody full

**@aguyaharonyair** (2026-04-19):
🤖 Job manager picked up this issue. I will drive it to a PR and comment again when done or if I hit a blocker.

@kody full

**@aguyaharonyair** (2026-04-19):
🤖 Job manager picked up this issue. I will drive it to a PR and comment again when done or if I hit a blocker.

@kody full

**@aguyaharonyair** (2026-04-19):
🤖 Job manager picked up this issue. I will drive it to a PR and comment again when done or if I hit a blocker.

@kody full

**@aguyaharonyair** (2026-04-19):
🚀 Kody pipeline started: `1279-260419-120101` ([logs](https://github.com/A-Guy-educ/A-Guy/actions/runs/24628297807))

