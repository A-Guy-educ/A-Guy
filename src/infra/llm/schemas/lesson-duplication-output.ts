/**
 * Output schemas for the lesson-duplication variation pipeline.
 *
 * These schemas are passed to Genkit's `ai.generate({ output: { schema } })` so
 * Gemini's JSON-mode refuses to emit non-conforming output. They are the durable
 * fix for the `answer.kind`-and-friends hallucination class that `sanitizeAiBlocks`
 * patches over after the fact.
 *
 * Design notes:
 *  - Gemini's responseSchema implementation does not handle large discriminated
 *    unions or `.strict()` well — `ContentSchema` (the canonical Zod definition
 *    at src/server/payload/collections/Exercises/schemas.ts) is too rich and
 *    will be rejected when translated to Gemini's JSON-Schema subset. We use a
 *    deliberately relaxed shape here that constrains the high-value bits
 *    (top-level envelope, block list, per-block `id` + `type`) and lets
 *    everything else pass through. `sanitizeAiBlocks` + `payload.create` Zod
 *    validation remain the canonical enforcement; this schema is a coarse
 *    gate that catches whole-shape mistakes before they reach those layers.
 *  - All block objects use `.passthrough()` so block-type-specific fields
 *    survive untouched.
 */
import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// Shared inline rich-text shape
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inline rich-text node — relaxed copy of the strict version in
 * collections/Exercises/schemas.ts. We accept any string for `format` so a
 * stale model output doesn't fail the whole generation; the strict schema at
 * payload.create still enforces 'md-math-v1'.
 */
const InlineRichTextSchema = z
  .object({
    type: z.literal('rich_text'),
    format: z.string(),
    value: z.string(),
    mediaIds: z.array(z.string()).optional(),
  })
  .passthrough()

// ─────────────────────────────────────────────────────────────────────────────
// Pass 1 — Creative pass (full exercise content)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One content block. We enforce only `id` and `type`; per-type fields differ
 * across the 12 block variants and Gemini's responseSchema cannot represent
 * the full discriminated union reliably. `.passthrough()` keeps everything
 * the model emits beyond those two keys.
 */
const VariationContentBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
  })
  .passthrough()

/**
 * Schema for pass 1's output. The model returns a full `content.blocks` shape
 * matching the input exercise's block layout (same length, same ids, same
 * types), with question/hint/phrasing fields rewritten per the variation level.
 */
export const LessonVariationOutputSchema = z
  .object({
    content: z
      .object({
        blocks: z.array(VariationContentBlockSchema).min(1),
      })
      .passthrough(),
  })
  .passthrough()

export type LessonVariationOutput = z.infer<typeof LessonVariationOutputSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Pass 2 — Deterministic derivation pass (solution + answer only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schema for pass 2's output. The model independently re-solves the new
 * question and returns just the solution/fullSolution/answer fields — these
 * overwrite whatever pass 1 wrote for the same fields (pass 1 cannot be
 * trusted to solve correctly at temp 0.7).
 *
 * `answer.correctOptionIds` is optional: not every question type carries it
 * (e.g. free-response, geometry, axis). The merge step in the variation
 * service only applies it when present.
 */
export const SolutionDerivationOutputSchema = z
  .object({
    solution: InlineRichTextSchema.optional(),
    fullSolution: InlineRichTextSchema.optional(),
    answer: z
      .object({
        correctOptionIds: z.array(z.string().min(1)).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough()

export type SolutionDerivationOutput = z.infer<typeof SolutionDerivationOutputSchema>
