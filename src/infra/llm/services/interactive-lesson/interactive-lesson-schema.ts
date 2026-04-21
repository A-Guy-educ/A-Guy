/**
 * Zod response schema for the Gemini interactive lesson call.
 *
 * Passed to Gemini via `responseSchema` + `responseMimeType: application/json`
 * (direct fetch in interactive-lesson-generation-service.ts) so the model
 * is constrained to produce exactly this shape. Eliminates field-name
 * variations (`id` vs `label`, `p1`/`p2` vs `from`/`to`, etc.) at the
 * source instead of normalizing them defensively after the fact.
 *
 * Schema complexity constraint: Gemini's responseSchema endpoint accepts
 * a strict OpenAPI 3.0 subset. Keep this schema flat — avoid `$ref`,
 * `$defs`, `oneOf` with discriminator, etc. The `stripUnsupportedKeys`
 * helper only strips `$schema` and `additionalProperties`; other
 * JSON-Schema-only constructs will pass through and cause API errors.
 *
 * NOTE: the existing validators/normalizers in the service still run as
 * a safety net for:
 *   - Rare cases where Gemini ignores the schema
 *   - Error responses (IMAGE_UNCLEAR, NOT_MATH) that bypass the schema
 */
import { z } from 'zod'

const GeoPointSchema = z.object({
  label: z.string(),
  x: z.number(),
  y: z.number(),
})

const GeoSegmentSchema = z.object({
  from: z.string(),
  to: z.string(),
  style: z.enum(['solid', 'dashed', 'bold']).optional(),
  color: z.enum(['blue', 'red', 'green', 'orange', 'purple']).optional(),
})

const GeoAngleSchema = z.object({
  points: z.array(z.string()).length(3),
  rightAngle: z.boolean().optional(),
})

const GeoLabelSchema = z.object({
  text: z.string(),
  x: z.number(),
  y: z.number(),
  fontSize: z.number().optional(),
})

const GeometrySchema = z.object({
  width: z.number(),
  height: z.number(),
  points: z.array(GeoPointSchema),
  segments: z.array(GeoSegmentSchema),
  angles: z.array(GeoAngleSchema),
  labels: z.array(GeoLabelSchema),
})

const StepSchema = z.object({
  id: z.number(),
  title: z.string(),
  claim: z.string(),
  reason: z.string(),
  narration: z.string(),
  explanation: z.string(),
  durationSeconds: z.number(),
  /** Array of [from, to] label pairs. */
  highlightSegments: z.array(z.array(z.string()).length(2)),
  highlightPoints: z.array(z.string()),
})

export const InteractiveLessonResponseSchema = z.object({
  title: z.string(),
  geometry: GeometrySchema,
  steps: z.array(StepSchema),
})

export type InteractiveLessonResponseShape = z.infer<typeof InteractiveLessonResponseSchema>
