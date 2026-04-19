The sandbox requires user approval to write files outside the task directory. Since the Write tool is asking for permission (rather than being automatically blocked like Bash), let me present the implementation details and request authorization.

**Summary of what needs to be created/modified:**

**New files to create:**
1. `src/lib/latex-parser/split-exercises.ts` — Extracted `splitLatexIntoExercises` utility with JSDoc and solution-routing contract
2. `tests/unit/lib/latex-parser/split-exercises.spec.ts` — 10 unit tests covering all solution-routing scenarios
3. `tests/unit/app/api/lessons/create-context-exercises/combined-latex-block.spec.ts` — 6 tests for the combined LaTeX block format

**Files to modify:**
4. `src/app/api/exercises/import-latex-ai/route.ts` — Replace inline `splitLatexIntoExercises` with import from new utility
5. `tests/unit/lib/context-exercise-parser/parser-gaps.test.ts` — Add `describe('solution round-trip through create-context-exercises')` with 3 test cases

**To proceed, please approve write access for files outside `.kody/tasks/1279-260419-120101/`.**

The `write_files.py` in the task directory already contains all file contents and patching logic — it just needs to be executed. Can you grant the permission for the Write tool to create these files in `src/` and `tests/unit/`, or run this command manually?

```bash
python3 /home/runner/work/A-Guy/A-Guy/.kody/tasks/1279-260419-120101/write_files.py
```

---

**Plan overview (see `.kody/tasks/1279-260419-120101/PLAN.md` for full details):**

| Step | File | What |
|------|------|------|
| 1 | `src/lib/latex-parser/split-exercises.ts` | New utility exporting `splitLatexIntoExercises` with JSDoc contract |
| 2 | `src/app/api/exercises/import-latex-ai/route.ts` | Remove inline fn, import from new utility |
| 3 | `tests/unit/lib/latex-parser/split-exercises.spec.ts` | 10 test cases: separate solutions, inline solutions, no solutions, mismatched numbers, subsection variants, etc. |
| 4 | `tests/unit/app/api/lessons/create-context-exercises/combined-latex-block.spec.ts` | 6 tests for `buildCombinedLatexBlock`: with solution (3 blocks), without solution (1 block), multi-exercise, empty solution, multiline |
| 5 | `tests/unit/lib/context-exercise-parser/parser-gaps.test.ts` | 3 new tests verifying round-trip: exercises with solutions → 2 LaTeX blocks, without → 1 block, mixed |

**Solution routing contract documented in JSDoc:**
- Solutions go in question block `solution` fields, never as separate LaTeX blocks
- `create-context-exercises` combines exercise + solution with `\section*{פתרון}` into 2 LaTeX blocks
- `splitLatexIntoExercises` strips solution sections from exercise chunks (AI prompt tells it to skip them anyway)