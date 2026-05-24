---
name: gemini-responseschema-collapses-complex-shapes
title: Gemini Responseschema Collapses Complex Shapes
type: lesson
source: task:1748
recorded_at: 2026-05-24T07:48:33Z
---

Gemini's responseSchema collapses nested object/array schemas into literal string arrays of property names. For example, a per-block array shape `{ blocks: [{ id, solution, fullSolution, answer }] }` becomes `{ "blocks": ["id", "solution", "fullSolution", "answer"] }` — a literal array of strings, not objects. Both LessonVariationOutputSchema (pass 1) and SolutionDerivationOutputSchema (pass 2) exhibited this collapse. The fix is to omit outputSchema from generateChatCompletion, parse result.text only, and validate post-hoc with Zod's safeParse.

Why: Gemini's v1beta responseSchema implementation cannot faithfully represent discriminated unions, nested arrays of objects, or .strict() envelopes. The Zod schema is still useful for runtime validation — just not as a schema fed to Gemini.

How to apply: When wiring up any new Genkit outputSchema, test with a multi-block/multi-field response first. If Gemini returns a literal array of field names instead of structured objects, switch to text-only + Zod validation.

**Why:** This bug caused MISSING_SOLUTION and MISSING_FULL_SOLUTION warnings in production. Future developers should not re-introduce structured output for Gemini without testing first.

**Source task:** `1748`
