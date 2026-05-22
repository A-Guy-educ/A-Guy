/**
 * Output schemas for the lesson-duplication variation pipeline.
 *
 * Passed to Genkit's `ai.generate({ output: { schema } })` so Gemini's
 * responseSchema mode refuses to emit non-conforming output.
 *
 * Status (2026-05-13):
 *  - `SolutionDerivationOutputSchema` (pass 2): IN USE. Small/well-bounded —
 *    Gemini handles it correctly. Verified live against gemini-2.5-pro.
 *  - `LessonVariationOutputSchema` (pass 1): NOT WIRED UP. Verified live that
 *    Gemini collapses the full content.blocks shape to `{ "content": "blocks" }`
 *    (treating the property name as a string value) regardless of whether the
 *    envelope is `.strict()` or `.passthrough()`. The schema is kept here as
 *    documentation of the intended shape and to seed the next attempt — when
 *    Genkit / Gemini structured-output support for nested object schemas
 *    improves, the variation service can opt back in by re-adding the
 *    `outputSchema: LessonVariationOutputSchema` argument to pass 1.
 *
 * Design notes:
 *  - Gemini's responseSchema implementation does not handle large discriminated
 *    unions, `.strict()` envelopes, or `additionalProperties: true` well.
 *    `ContentSchema` (the canonical Zod definition at
 *    src/server/payload/collections/Exercises/schemas.ts) is too rich to use
 *    directly. The pass-1 schema below is a deliberately relaxed shape that
 *    only constrains envelope + per-block `id`/`type`; block objects use
 *    `.passthrough()` so per-type fields survive.
 *  - `sanitizeAiBlocks` + `payload.create`'s strict Zod validation remain the
 *    canonical enforcement for pass-1 output.
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
 *
 * No `.min(1)` constraints on strings: Gemini's `responseSchema` ignores
 * `minLength` and using it can cause it to silently downgrade the schema.
 * Empty strings are caught downstream by the strict Exercise Zod schema at
 * payload.create.
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
 *
 * No `.min(1)` constraints — see note on InlineRichTextSchema. Empty `id`/
 * `type` would fail at payload.create's strict schema anyway.
 */
const VariationContentBlockSchema = z
  .object({
    id: z.string(),
    type: z.string(),
  })
  .passthrough()

/**
 * Schema for pass 1's output. The model returns a full `content.blocks` shape
 * matching the input exercise's block layout (same length, same ids, same
 * types), with question/hint/phrasing fields rewritten per the variation level.
 *
 * IMPORTANT: the envelope (top-level + `content`) does NOT use `.passthrough()`.
 * Gemini's responseSchema interpreter chokes on the resulting JSON Schema
 * (sets `additionalProperties: true` on the object, and Gemini was observed
 * to silently collapse output to `{ "content": "blocks" }` or
 * `{ "content": null }`). The envelope is closed; only the block objects
 * themselves use passthrough, because their per-type field set is too varied
 * to enumerate without a full discriminated union.
 */
export const LessonVariationOutputSchema = z.object({
  content: z.object({
    blocks: z.array(VariationContentBlockSchema),
  }),
})

export type LessonVariationOutput = z.infer<typeof LessonVariationOutputSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Pass 1 — Input-derived JSON Schema (live, used at runtime)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Raw JSON-Schema shape compatible with both standard JSON Schema (which
 * Genkit's Ajv validator enforces before forwarding) and Gemini's
 * `responseSchema` (which accepts the same OpenAPI 3.0 subset in either case).
 * Lowercase types are required because Ajv rejects Gemini's uppercase dialect.
 *
 * Supported keywords: `type`, `properties`, `required`, `items`, `enum`,
 * `anyOf`. `additionalProperties` is rejected by Gemini's v1beta API.
 */
type GeminiJsonSchema =
  | { type: 'string'; enum?: string[] }
  | { type: 'number' | 'integer' | 'boolean' }
  | { type: 'array'; items: GeminiJsonSchema }
  | { type: 'object'; properties: Record<string, GeminiJsonSchema>; required?: string[] }
  | { anyOf: GeminiJsonSchema[] }

/**
 * The rich-text sub-schema shape that must exist on every question_* block
 * in the pass-1 output. Used as the forced slot when the source doesn't already
 * define hint/solution/fullSolution.
 */
const INLINE_RICH_TEXT_JSON_SCHEMA: GeminiJsonSchema = {
  type: 'object',
  properties: {
    type: { type: 'string' },
    format: { type: 'string' },
    value: { type: 'string' },
    mediaIds: { type: 'array', items: { type: 'string' } },
  },
}

const QUESTION_FORCED_SLOTS = ['hint', 'solution', 'fullSolution'] as const

/**
 * Detect whether a block object schema represents a question_* block by checking
 * whether its `type` property carries a value starting with "question_".
 */
function isQuestionBlockSchema(blockSchema: GeminiJsonSchema): boolean {
  if ((blockSchema as { type?: string }).type !== 'object') return false
  const obj = blockSchema as {
    type: 'object'
    properties: Record<string, GeminiJsonSchema>
    required?: string[]
  }
  const props = obj.properties
  if (!props) return false
  const typeSchema = props['type']
  if (!typeSchema) return false
  // Check for enum values (added by deriveJsonSchemaFromValue for identifier strings)
  const asEnum = typeSchema as { enum?: string[] }
  if (Array.isArray(asEnum.enum) && asEnum.enum.some((v: string) => v.startsWith('question_'))) {
    return true
  }
  // Also handle const (if deriveJsonSchemaFromValue is changed in future to use const)
  const asConst = typeSchema as { const?: string }
  if (typeof asConst.const === 'string' && asConst.const.startsWith('question_')) return true
  // Generic string type — cannot reliably identify as question block.
  return false
}

/**
 * Returns true if every schema in the array is a question-block schema.
 */
function allAreQuestionBlocks(schemas: GeminiJsonSchema[]): boolean {
  return schemas.length > 0 && schemas.every(isQuestionBlockSchema)
}

/**
 * Augment a single block object schema: add hint/solution/fullSolution slots
 * (required, rich-text-shaped) when the block is a question_* variant.
 * Existing slot sub-schemas from the source are preserved.
 */
function augmentBlockSchema(blockSchema: GeminiJsonSchema): GeminiJsonSchema {
  if ((blockSchema as { type?: string }).type !== 'object') return blockSchema
  const obj = blockSchema as {
    type: 'object'
    properties: Record<string, GeminiJsonSchema>
    required?: string[]
  }
  if (!obj.properties) return blockSchema

  const isQuestion = isQuestionBlockSchema(blockSchema)
  if (!isQuestion) return blockSchema

  const properties = { ...obj.properties }
  const required = obj.required ? [...obj.required] : []

  for (const slot of QUESTION_FORCED_SLOTS) {
    if (!properties[slot]) {
      properties[slot] = INLINE_RICH_TEXT_JSON_SCHEMA
    }
    if (!required.includes(slot)) {
      required.push(slot)
    }
  }

  return { type: 'object', properties, required }
}

/**
 * Recursively walk a blocks schema (which may be a bare object schema or an
 * anyOf union) and augment every question_* block variant with
 * hint/solution/fullSolution slots. Returns a new schema — never mutates the
 * input.
 */
function augmentBlocksSchema(schema: GeminiJsonSchema): GeminiJsonSchema {
  if ((schema as { type?: string }).type === 'array') {
    const arraySchema = schema as { type: 'array'; items: GeminiJsonSchema }
    const items = arraySchema.items
    if (!items) return schema

    if ((items as { type?: string }).type === 'object') {
      // Single block variant — check if it's a question block
      return {
        type: 'array',
        items: augmentBlockSchema(
          items as {
            type: 'object'
            properties: Record<string, GeminiJsonSchema>
            required?: string[]
          },
        ),
      }
    }

    if (Array.isArray((items as { anyOf?: unknown }).anyOf)) {
      // Heterogeneous block array — augment each anyOf branch
      const anyOfItems = (items as { anyOf: GeminiJsonSchema[] }).anyOf
      const augmentedAnyOf = anyOfItems.map(augmentBlockSchema)
      // If ALL variants are question blocks, add hint/solution/fullSolution to
      // the required array of every variant so Gemini can't drop them.
      if (allAreQuestionBlocks(augmentedAnyOf)) {
        for (const variant of augmentedAnyOf) {
          if ((variant as { type?: string }).type === 'object') {
            const obj = variant as {
              required?: string[]
              properties: Record<string, GeminiJsonSchema>
            }
            for (const slot of QUESTION_FORCED_SLOTS) {
              if (!obj.required?.includes(slot)) {
                obj.required = [...(obj.required ?? []), slot]
              }
            }
          }
        }
      }
      return { type: 'array', items: { anyOf: augmentedAnyOf } }
    }

    return schema
  }

  if ((schema as { type?: string }).type === 'object') {
    return augmentBlockSchema(
      schema as {
        type: 'object'
        properties: Record<string, GeminiJsonSchema>
        required?: string[]
      },
    )
  }

  return schema
}

/**
 * Walk a JSON value and produce a Gemini-compatible JSON Schema that mirrors
 * its shape. Used to derive a per-exercise schema at runtime: the input
 * exercise IS the schema, so Gemini's variation must keep the same fields,
 * same nesting, and (via array unions) the same heterogeneous block layout.
 *
 * This sidesteps the problem of hand-authoring a discriminated union for the
 * full 12-block ContentSchema — we don't need to know what shapes exist in
 * advance, we only need the shapes that appear in *this* exercise.
 *
 * Edge cases:
 *  - `null`/`undefined`: fall back to `STRING` (Gemini's responseSchema does
 *    not support `nullable: true` reliably in v1beta; using string lets the
 *    model emit any literal without rejecting the schema).
 *  - Empty arrays: default items to `STRING` (no shape info is recoverable).
 *  - Heterogeneous arrays (e.g. `content.blocks` mixing question_select,
 *    rich_text, question_axis…): produce an `anyOf` over the unique item
 *    shapes seen in the input.
 *
 * The returned schema mirrors structure only — Gemini fills in NEW values
 * matching that structure. IDs aren't preserved at the schema level (no
 * literal-value enforcement in Gemini); the prompt instructs the model to
 * keep ids, and `payload.create` validates downstream.
 */
export function deriveJsonSchemaFromValue(value: unknown): GeminiJsonSchema {
  if (value === null || value === undefined) {
    return { type: 'string' }
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { type: 'array', items: { type: 'string' } }
    }
    if (value.length === 1) {
      return { type: 'array', items: deriveJsonSchemaFromValue(value[0]) }
    }
    // Multiple items — dedupe by canonical JSON and union with `anyOf` so the
    // model can emit each shape in its correct slot. Single-shape arrays
    // collapse to a plain `items`.
    const seen = new Map<string, GeminiJsonSchema>()
    for (const item of value) {
      const itemSchema = deriveJsonSchemaFromValue(item)
      const key = JSON.stringify(itemSchema)
      if (!seen.has(key)) {
        seen.set(key, itemSchema)
      }
    }
    const unique = Array.from(seen.values())
    if (unique.length === 1) {
      return { type: 'array', items: unique[0] }
    }
    return { type: 'array', items: { anyOf: unique } }
  }
  if (typeof value === 'object') {
    const properties: Record<string, GeminiJsonSchema> = {}
    const required: string[] = []
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      properties[k] = deriveJsonSchemaFromValue(v)
      required.push(k)
    }
    return { type: 'object', properties, required }
  }
  if (typeof value === 'string') {
    // Preserve short identifier-like strings as `enum` so callers (notably
    // augmentBlocksSchema) can identify block-type fields without falling back
    // to a generic `type: 'string'`. Long prose strings are left as plain strings.
    if (value.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(value)) {
      return { type: 'string', enum: [value] }
    }
    return { type: 'string' }
  }
  if (typeof value === 'number') {
    return { type: Number.isInteger(value) ? 'integer' : 'number' }
  }
  if (typeof value === 'boolean') return { type: 'boolean' }
  return { type: 'string' }
}

/**
 * Build the pass-1 output JSON Schema for a specific source exercise. Wraps
 * the input's `content.blocks` shape in a closed `{ content: { blocks: … } }`
 * envelope so Gemini stays focused on the variation payload and doesn't
 * waste tokens echoing back exercise metadata (id, tenant, slug, …).
 */
export function buildPass1JsonSchemaForExercise(exercise: unknown): GeminiJsonSchema {
  const content = (exercise as { content?: unknown }).content
  const rawBlocks =
    content && typeof content === 'object' ? (content as { blocks?: unknown }).blocks : undefined
  const blocks = Array.isArray(rawBlocks) ? rawBlocks : []
  const blocksSchema = deriveJsonSchemaFromValue(blocks)
  const augmentedBlocksSchema = augmentBlocksSchema(blocksSchema)
  return {
    type: 'object',
    properties: {
      content: {
        type: 'object',
        properties: { blocks: augmentedBlocksSchema },
        required: ['blocks'],
      },
    },
    required: ['content'],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pass 2 — Deterministic derivation pass (solution + answer only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-block patch entry — one entry per question block, keyed by block id.
 * Only the fields that need to be updated are required; others are optional.
 */
const SolutionDerivationBlockSchema = z.object({
  id: z.string(),
  solution: InlineRichTextSchema.optional(),
  fullSolution: InlineRichTextSchema.optional(),
  answer: z
    .object({
      correctOptionIds: z.array(z.string()).optional(),
    })
    .optional(),
})

/**
 * Schema for pass 2's output. The model independently re-solves each
 * question block (identified by id) and returns an array of per-block patches.
 * These overwrite whatever pass 1 wrote for the same fields (pass 1 cannot be
 * trusted to solve correctly at temp 0.7).
 *
 * Blocks that have no patch entry are left untouched (validator emits a
 * warning, which is correct). Non-question blocks are never included in the
 * blocks array.
 *
 * Empty blocks array is valid — an exercise with zero question blocks
 * (all rich_text / svg) produces no patches.
 */
export const SolutionDerivationOutputSchema = z.object({
  blocks: z.array(SolutionDerivationBlockSchema),
})

export type SolutionDerivationOutput = z.infer<typeof SolutionDerivationOutputSchema>
