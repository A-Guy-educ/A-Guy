# Solution Routing in Exercise Conversion

## Overview

When exercises are created from PDF context extraction, each exercise gets two LaTeX blocks:
- **Block 0**: Exercise content (questions, sub-questions, diagrams)
- **Block 1**: Solution content (answers, explanations, derivations)

The "Convert LaTeX Block" button converts these LaTeX blocks into interactive question blocks. Without solution routing, the solution block would be converted into additional question blocks — making answers appear as questions to students.

## Pipeline

```
PDF → Convert Context → LaTeX extraction
    → Create Exercises → Exercise with [latex block, solution latex block]
    → Convert LaTeX Block → Interactive question blocks with solutions
```

## How Solution Routing Works

The solution routing logic lives in `convert-latex-block.ts` and runs in three phases:

### Phase 1: Pre-scan (before conversion loop)

Before any blocks are converted, the endpoint scans all LaTeX blocks to classify them:

```
for each LaTeX block:
  read first non-empty line
  if isSolutionHeader(firstLine) → mark as solution block
```

`isSolutionHeader()` (from `enumerate-parser.ts`) detects patterns like:
- `\section*{פתרון תרגיל N}`
- `\subsection*{פתרון שאלה N}`
- `\section*{פתרונות}`
- `\textbf{פתרון תרגיל N:}`
- `\subsection*{תשובה סופית - שאלה N}`

### Phase 2: Combine for AI

For each exercise LaTeX block, if the next block is a solution block, their LaTeX content is combined into a single string for the AI:

```
combined = exerciseLatex + "\n\n" + solutionLatex
```

This combined LaTeX is only used when the AI fallback runs (script parser failure). The script parser still processes the exercise block alone.

### Phase 3: Conversion loop

During the main conversion loop:

1. **Solution blocks are removed** — they're spliced out of the block array and never converted independently.

2. **Exercise blocks convert normally** — the script parser runs first (unchanged). If it fails, the AI fallback receives the combined exercise+solution LaTeX.

3. **The AI prompt** instructs the model to place solution content in the `solution` field of each question block, not as separate blocks.

## What Changes vs. Previous Behavior

| Aspect | Before | After |
|--------|--------|-------|
| Exercise block | Converted normally | Converted normally (unchanged) |
| Solution block | Converted to question blocks (bug) | Removed, content sent to AI with exercise |
| AI prompt | "Skip solution sections" | "Place solutions in question block's solution field" |
| Script parser | Unchanged | Unchanged |
| `isScriptOutputMeaningful` | Unchanged | Unchanged |
| `create-context-exercises` | Unchanged | Unchanged |

## Fallback Behavior

- If `isSolutionHeader` fails to detect a solution block → the block stays as-is and gets converted normally (same as before, no regression)
- If the AI fallback fails → the exercise LaTeX block stays unconverted (same as before)
- If there's no solution block → exercise converts exactly as before

## Key Files

- `src/server/payload/endpoints/exercises/convert-latex-block.ts` — solution detection + AI combination
- `src/app/api/exercises/import-latex-ai/route.ts` — AI prompt with solution field instructions
- `src/lib/latex-parser/enumerate-parser.ts` — `isSolutionHeader()` detection function
- `tests/unit/server/endpoints/convert-latex-block-solutions.test.ts` — unit tests
