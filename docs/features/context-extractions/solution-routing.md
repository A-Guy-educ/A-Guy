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

### Phase 5: Reroute trailing solution rich_text blocks

After Phase 4, the script parser may have produced a trailing `rich_text` block that is actually solution content (e.g., it converted `\section*{פתרון תרגיל 1}` into a markdown `## פתרון תרגיל 1` header followed by answer content). Such a block would render as a separate "page" to students.

`rerouteTrailingSolutionRichText()` detects this using `looksLikeSolutionContent()` (matches markdown headers, bold formatting, or plain prefixes for "פתרון", "פתרונות", "תשובה סופית"). When detected:
- Strips the header line
- Attaches the body to the preceding question block's `solution` field
- If the question already has a solution, appends to it
- Removes the trailing rich_text block

If there's no preceding question block, the trailing solution block is removed (it's not useful standalone).

### Phase 6: AI fallback for missing hints and solutions

After Phase 5, `fillMissingSolutionsWithAI()` walks the blocks looking for question blocks missing **either a hint or a solution**. For each one, it calls `generateSupport` (the same service the admin "Generate with AI" button uses) requesting only the missing fields.

This handles cases where:
- The label-matching fallback put the whole solution on only the last block (other blocks are empty)
- There was no solution LaTeX at all for this exercise
- Some sub-questions appeared in the question content but were missing from the solution text
- No hints existed in the LaTeX (hints are never extracted from LaTeX)

**Per-field optimization**: if a block has a solution but no hint, the AI is asked to generate only a hint (one field). If a block has neither, both are requested in one call.

**Failure handling**: if AI generation fails (rate limit, network error, parse error), the block is left without a hint/solution and a warning is logged. The conversion continues — failures don't abort the whole operation.

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

### Example 3: Unmatched count (fallback + AI fill)

Solution has 6 parts but only 3 question blocks → fallback dumps the whole solution on the last block. The first two blocks have no solution → Phase 5 calls AI to generate solutions for them.

### Example 4: No solution at all

The exercise has 4 question blocks but no solution LaTeX → all 4 are missing solutions → Phase 5 generates solutions for all 4 via AI.

## What Changes vs. Previous Behavior

| Aspect | Before This Work | After |
|--------|------------------|-------|
| Solution block | Converted to question blocks (bug) | Removed, content routed to `solution` field |
| Multi-sub-question exercises | Whole solution dumped on last block | Each sub-question block gets its own solution part (when labels match) |
| Single-question exercises | Whole solution attached | Whole solution attached (unchanged) |
| AI prompt | "Skip solution sections" | "Place solutions in question block's solution field" |
| Script parser | Unchanged | Unchanged |
| `create-context-exercises` | Unchanged | Unchanged |
| Empty `solution` fields | Stayed empty (admin had to click "Generate with AI" per block) | Auto-filled by AI in Phase 5 |

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
