I now have a complete picture of all the changed files. Let me compile the review.

## Verdict: PASS

## Summary

The PR correctly extracts `splitLatexIntoExercises` into a unit-testable utility, updates `import-latex-ai/route.ts` to use it, creates three test files covering all required scenarios, and updates the existing `parser-gaps.test.ts` with solution round-trip tests. All files reviewed: the JSDoc contract is accurate, the actual `makeLatexBlock`/`LatexBlock` types are used in tests, and the phantom-filter behavior is correctly documented.

## Findings

### Critical

None.

### Major

None.

### Minor

None.

---

## Two-Pass Review

**Pass 1 — CRITICAL (must fix before merge):**

No critical issues found.

### SQL & Data Safety

N/A — no database operations introduced; this is pure logic tests + a utility extraction.

### Race Conditions & Concurrency

N/A — unit tests, no concurrency.

### LLM Output Trust Boundary

N/A — no LLM calls in the changed code; `import-latex-ai/route.ts` LLM integration was pre-existing.

### Shell Injection

N/A — no shell operations.

### Enum & Value Completeness

N/A — no new enum/status values introduced.

**Pass 2 — INFORMATIONAL (should review, may auto-fix):**

### Test Gaps

All planned test files exist and cover the required scenarios:
- `tests/unit/lib/latex-parser/split-exercises.spec.ts` — 10 cases covering separate solutions, inline solutions, no solutions, mismatched numbers, subsection variants, preamble stripping, empty/no-match, single exercise, chunk boundaries, and `\section*{פתרון שאלה N}` variant. ✓
- `tests/unit/app/api/lessons/create-context-exercises/combined-latex-block.spec.ts` — 6 cases covering two-block with solution, one-block without solution, block type verification, multi-exercise, empty string treatment, and multiline content preservation. ✓
- `tests/unit/lib/context-exercise-parser/parser-gaps.test.ts` — updated with `describe('solution round-trip through create-context-exercises')` block covering exercises with solutions → 2 blocks, without → 1 block, and the phantom-filter path documented. ✓

### Dead Code & Consistency

- **`src/app/api/exercises/import-latex-ai/route.ts`** — The inline `splitLatexIntoExercises` function was successfully removed; the route now imports from `@/lib/latex-parser/split-exercises` (line 16). The extraction goal is fully achieved. ✓
- **JSDoc accuracy** — The `@solution-routing-contract` on `split-exercises.ts:7–12` accurately reflects the actual two-separate-block pattern from `create-context-exercises/route.ts:88–93`. The previous review's Major #1 finding is resolved. ✓
- **Type accuracy in `combined-latex-block.spec.ts`** — The test uses the real `makeLatexBlock` from `@/lib/latex-parser/block-generators` and the real `LatexBlock` type from `@/server/payload/collections/Exercises/types` (lines 14, 16). The helper returns `LatexBlock[]` not `string[]`. The previous review's Major #5 finding is resolved. ✓

### Design System Compliance (frontend files only)

N/A — no frontend files changed.

### Performance & Bundle Impact

- `vitest.config.mts` uses `pool: 'forks'` and `fileParallelism: false` — appropriate for integration tests. Unit tests in `tests/unit/` can run in this pool without issue; no separate pool needed at this stage.

### Type Coercion at Boundaries

N/A — no serialization boundaries introduced.

---

**All acceptance criteria met.** No issues require fixing before merge.