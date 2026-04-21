# Solution Routing in Exercise Conversion

## Overview

When exercises are created from PDF context extraction, each exercise gets two LaTeX blocks:
- **Block 0**: Exercise content (questions, sub-questions, diagrams)
- **Block 1**: Solution content (answers, explanations, derivations)

The "Convert LaTeX Block" button converts these LaTeX blocks into interactive question blocks. Solution routing ensures:
- The solution block doesn't appear as a separate question (it would otherwise be converted into bogus question blocks).
- Each sub-question block receives **its specific** solution part in the `solution` field — not the whole exercise's solution dumped on the last block.

## Pipeline

```
PDF → Convert Context → LaTeX extraction
    → Create Exercises → Exercise with [latex block, solution latex block]
    → Convert LaTeX Block → Interactive question blocks with per-sub-question solutions
```

## How Solution Routing Works

The solution routing logic lives in `convert-latex-block.ts`.

### Phase 1: Detect solution blocks

The endpoint scans the exercise's LaTeX blocks and identifies which ones are solutions:
- **Origin-based**: For exercises with `origin: 'context_extraction'` (created by Create Exercises) and ≥2 LaTeX blocks, the **last** LaTeX block is always the solution.
- **Header-based** (other origins): A LaTeX block whose first line matches `isSolutionHeader()` is treated as a solution. Patterns include `\section*{פתרון תרגיל N}`, `\subsection*{פתרון שאלה N}`, `\section*{פתרונות}`, `\textbf{פתרון תרגיל N:}`, etc.

### Phase 2: Remove solution blocks from the conversion path

In the conversion loop, solution blocks are removed from the block array entirely. They are NOT converted independently (which would have produced bogus question blocks from the answer text).

### Phase 3: Convert exercise blocks (unchanged)

Each exercise LaTeX block is converted by the script parser (or AI fallback if the script parser fails). This produces a series of question blocks.

### Phase 4: Attach solution to question blocks (per sub-question)

`attachSolutionToBlocks()` distributes the solution content across the question blocks using a **two-pass label detection** strategy:

#### Pass 1 — Hebrew letter labels only
Splits the solution by top-level Hebrew letter labels: `א.`, `ב.`, `ג.`, `ד.`, etc.

If the number of parts equals the number of question blocks → 1:1 assignment by document order.

#### Pass 2 — Hebrew letters + numeric labels
If Pass 1 doesn't match the count, splits by both Hebrew letters AND parenthetical numeric labels: `(1)`, `(2)`. Empty parent labels (e.g. `ג.` immediately followed by `(1)(2)` with no content of its own) are filtered out.

If the part count now equals the question block count → 1:1 assignment.

#### Fallback
If neither pass produces a matching count, the entire solution is attached to the last question block (preserves the previous behavior — no regression).

#### Single-question case
If the exercise has only one question block, the entire solution goes to it regardless of label structure.

## Examples

### Example 1: Simple matching (Pass 1 succeeds)

Solution:
```
א. content for א
ב. content for ב
ג. content for ג
ד. content for ד
```

Question blocks: 4 (א, ב, ג, ד) → Pass 1 produces 4 parts → 1:1 match.

### Example 2: Nested sub-questions (Pass 2 succeeds)

Solution:
```
א. content for א
ב. content for ב
ג. (1) content for ג(1) (2) content for ג(2)
ד. content for ד
```

Question blocks: 5 (א, ב, ג(1), ג(2), ד — script parser flattens nested enumerate).

- Pass 1 produces 4 parts → mismatch.
- Pass 2 produces 5 parts (ג. parent is filtered as empty) → 1:1 match.

### Example 3: Unmatched count (fallback)

Solution has 6 parts but only 3 question blocks → falls back to dumping the whole solution on the last question block.

## What Changes vs. Previous Behavior

| Aspect | Before This Work | After |
|--------|------------------|-------|
| Solution block | Converted to question blocks (bug) | Removed, content routed to `solution` field |
| Multi-sub-question exercises | Whole solution dumped on last block | Each sub-question block gets its own solution part (when labels match) |
| Single-question exercises | Whole solution attached | Whole solution attached (unchanged) |
| AI prompt | "Skip solution sections" | "Place solutions in question block's solution field" |
| Script parser | Unchanged | Unchanged |
| `create-context-exercises` | Unchanged | Unchanged |

## Fallback Behavior (No Regressions)

- If solution detection fails → block stays as-is and gets converted normally (same as before)
- If label splitting doesn't match question block count → whole solution attached to last block (same as before this work)
- If AI fallback fails → exercise LaTeX block stays unconverted (same as before)
- If there's no solution block → exercise converts exactly as before

## Known Limitations (Out Of Scope)

These remain as known issues to address separately:

1. **Short answer blocks parsed as exercises**: The `context-exercise-parser` doesn't distinguish between full questions and short answer summaries (both use `\setcounter{enumi}{N}\item`). This causes some extractions to produce duplicate/bogus exercises. Separate fix needed in the parser.
2. **`__imported__` placeholder** in `acceptedAnswers` (from `makeFreeResponseBlock`) — cosmetic, doesn't affect solution routing.
3. **Question count mismatch**: When the solution has fewer/more labels than the question blocks (e.g. truncated extraction, extra ה/ו parts), the fallback applies. Could be improved with smarter best-effort matching in the future.

## Key Files

- [src/server/payload/endpoints/exercises/convert-latex-block.ts](../../../src/server/payload/endpoints/exercises/convert-latex-block.ts) — solution detection, AI combination, and `splitSolutionByLabels`/`attachSolutionToBlocks`
- [src/app/api/exercises/import-latex-ai/route.ts](../../../src/app/api/exercises/import-latex-ai/route.ts) — AI prompt with solution field instructions
- [src/lib/latex-parser/enumerate-parser.ts](../../../src/lib/latex-parser/enumerate-parser.ts) — `isSolutionHeader()` detection function
- [tests/unit/server/endpoints/convert-latex-block-solutions.test.ts](../../../tests/unit/server/endpoints/convert-latex-block-solutions.test.ts) — unit tests
