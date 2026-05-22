# Issue #1748 — Handoff Notes

## What was done

Dropped `outputSchema` from the pass-2 `generateChatCompletion` call in `lesson-duplication-variation-service.ts` and replaced the structured-output parsing path with a text-only + post-hoc Zod validation approach.

### Root cause
Gemini's `responseSchema` collapses per-block array shapes into literal string arrays of property names (e.g., `{ blocks: ["id", "solution", ...] }` instead of an array of objects). This affected both pass-1 `LessonVariationOutputSchema` (previously documented) and pass-2 `SolutionDerivationOutputSchema` (this fix).

### Changes

**`src/infra/llm/services/lesson-duplication-variation-service.ts`**
- Removed `outputSchema: SolutionDerivationOutputSchema` from pass-2 call; added comment citing issue #1748
- `extractPass2Patch(result, pass1Output)` now accepts pass1Output and filters patches against pass-1 question-block ids (drops hallucinated patches)
- `parseSolutionDerivationResponseFromText` now uses `SolutionDerivationOutputSchema.safeParse()` and throws `SyntaxError` on validation failure (so the existing retry envelope picks it up)
- Fixed type mismatch: `result.data as Pass2Patch` cast (Zod infers `correctOptionIds` as optional, interface requires it)
- `patch.answer!.correctOptionIds` — added `!` non-null assertion since we guard with `!== undefined`

**`src/infra/llm/schemas/lesson-duplication-output.ts`**
- Updated header comment: `SolutionDerivationOutputSchema` is now post-hoc validation only, not passed to Gemini's responseSchema

**`tests/unit/server/llm/services/lesson-duplication-variation-service.test.ts`**
- Added test: pass-2 intentionally omits `outputSchema` (issue #1748)
- Updated `result.output` path test to provide valid `text` for pass-2
- Added test: id-filtering — hallucinated patch id is dropped
- Added test: malformed JSON throws `SyntaxError` so retry envelope fires
- Added test: empty `blocks: []` is valid and preserved
- Removed duplicate old test asserting `outputSchema` was defined for pass-2
