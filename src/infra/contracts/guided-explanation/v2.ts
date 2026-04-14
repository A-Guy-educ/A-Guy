/**
 * Guided Explanation v2 — primitives-based schema.
 *
 * Gemini produces a sequence of drawing + timeline primitives (not a
 * pre-built SVG + fixed template). This lets it compose any math visual
 * from a small vocabulary: lines, circles, paths, text, equations, and
 * animation/narration controls.
 *
 * Security: every op is a closed discriminated union member. Zod validates
 * the op name and every arg before the runtime executes anything. No
 * untrusted scripts run. Text content is escaped at render time.
 *
 * Mental model: ops run sequentially. Drawing ops create SVG elements
 * (initially hidden — opacity 0 or stroke-dashoffset). Timeline ops
 * (show/draw/narrate/wait) reveal them and drive the animation.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** Allowed stroke/fill colors. Hex values also accepted. */
const COLOR_NAMES = ['blue', 'red', 'green', 'orange', 'purple', 'yellow', 'black', 'gray'] as const

const ColorSchema = z.union([
  z.enum(COLOR_NAMES),
  z.literal('none'),
  z.literal('transparent'),
  z.literal('currentColor'),
  z.string().regex(/^#[0-9a-fA-F]{3,8}$/),
])

const CoordSchema = z.number().finite()

const IdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, 'ID must be alphanumeric (with _ or -)')

// ---------------------------------------------------------------------------
// Drawing ops — create SVG elements (initially hidden)
// ---------------------------------------------------------------------------

const LineOpSchema = z
  .object({
    op: z.literal('line'),
    id: IdSchema.optional(),
    x1: CoordSchema,
    y1: CoordSchema,
    x2: CoordSchema,
    y2: CoordSchema,
    color: ColorSchema.optional(),
    strokeWidth: z.number().positive().max(20).optional(),
    dashed: z.boolean().optional(),
  })
  .passthrough()

const CircleOpSchema = z
  .object({
    op: z.literal('circle'),
    id: IdSchema.optional(),
    cx: CoordSchema,
    cy: CoordSchema,
    r: z.number().positive(),
    stroke: ColorSchema.optional(),
    fill: ColorSchema.optional(),
    strokeWidth: z.number().positive().max(20).optional(),
  })
  .passthrough()

const RectOpSchema = z
  .object({
    op: z.literal('rect'),
    id: IdSchema.optional(),
    x: CoordSchema,
    y: CoordSchema,
    width: z.number().positive(),
    height: z.number().positive(),
    stroke: ColorSchema.optional(),
    fill: ColorSchema.optional(),
    strokeWidth: z.number().positive().max(20).optional(),
  })
  .passthrough()

const PolygonOpSchema = z
  .object({
    op: z.literal('polygon'),
    id: IdSchema.optional(),
    points: z.array(z.tuple([CoordSchema, CoordSchema])).min(3),
    stroke: ColorSchema.optional(),
    fill: ColorSchema.optional(),
    strokeWidth: z.number().positive().max(20).optional(),
  })
  .passthrough()

const ArrowOpSchema = z
  .object({
    op: z.literal('arrow'),
    id: IdSchema.optional(),
    x1: CoordSchema,
    y1: CoordSchema,
    x2: CoordSchema,
    y2: CoordSchema,
    color: ColorSchema.optional(),
    strokeWidth: z.number().positive().max(20).optional(),
  })
  .passthrough()

const PathOpSchema = z
  .object({
    op: z.literal('path'),
    id: IdSchema.optional(),
    /** SVG path d-attribute. Limited length to prevent abuse. */
    d: z.string().min(1).max(2000),
    stroke: ColorSchema.optional(),
    fill: ColorSchema.optional(),
    strokeWidth: z.number().positive().max(20).optional(),
  })
  .passthrough()

const TextOpSchema = z
  .object({
    op: z.literal('text'),
    id: IdSchema.optional(),
    x: CoordSchema,
    y: CoordSchema,
    text: z.string().max(500),
    fontSize: z.number().positive().max(48).optional(),
    color: ColorSchema.optional(),
    anchor: z.enum(['start', 'middle', 'end']).optional(),
  })
  .passthrough()

const EquationOpSchema = z
  .object({
    op: z.literal('equation'),
    id: IdSchema.optional(),
    x: CoordSchema,
    y: CoordSchema,
    /** LaTeX string rendered via KaTeX. */
    latex: z.string().max(1000),
    fontSize: z.number().positive().max(48).optional(),
  })
  .passthrough()

const PointOpSchema = z
  .object({
    op: z.literal('point'),
    id: IdSchema.optional(),
    x: CoordSchema,
    y: CoordSchema,
    label: z.string().max(16).optional(),
    color: ColorSchema.optional(),
    /** Dot radius. Default 4. */
    r: z.number().positive().max(20).optional(),
    /** Label font size. Default 12. */
    fontSize: z.number().positive().max(48).optional(),
  })
  .passthrough()

// ---------------------------------------------------------------------------
// Timeline ops — animate the scene
// ---------------------------------------------------------------------------

const ShowOpSchema = z
  .object({
    op: z.literal('show'),
    id: IdSchema,
    durationMs: z.number().int().nonnegative().max(10_000).optional(),
  })
  .passthrough()

const HideOpSchema = z
  .object({
    op: z.literal('hide'),
    id: IdSchema,
  })
  .passthrough()

const DrawAnimatedOpSchema = z
  .object({
    op: z.literal('drawAnimated'),
    id: IdSchema,
    /** Duration in ms. Default 1000. */
    durationMs: z.number().int().positive().max(10_000).optional(),
  })
  .passthrough()

const HighlightOpSchema = z
  .object({
    op: z.literal('highlight'),
    id: IdSchema,
    /** Duration in ms. Default 1500. */
    durationMs: z.number().int().positive().max(10_000).optional(),
    color: ColorSchema.optional(),
  })
  .passthrough()

const NarrateOpSchema = z
  .object({
    op: z.literal('narrate'),
    /** Text shown in the caption box and spoken (if speech not provided). */
    display: z.string().min(1).max(2000),
    /** Optional override for TTS (may include Hebrew niqqud for better pronunciation). */
    speech: z.string().max(2000).optional(),
  })
  .passthrough()

const WaitOpSchema = z
  .object({
    op: z.literal('wait'),
    ms: z.number().int().nonnegative().max(30_000),
  })
  .passthrough()

// ---------------------------------------------------------------------------
// Union of all ops
// ---------------------------------------------------------------------------

export const OpSchema = z.discriminatedUnion('op', [
  // Drawing
  LineOpSchema,
  CircleOpSchema,
  RectOpSchema,
  PolygonOpSchema,
  ArrowOpSchema,
  PathOpSchema,
  TextOpSchema,
  EquationOpSchema,
  PointOpSchema,
  // Timeline
  ShowOpSchema,
  HideOpSchema,
  DrawAnimatedOpSchema,
  HighlightOpSchema,
  NarrateOpSchema,
  WaitOpSchema,
])

export type GuidedExplanationOp = z.infer<typeof OpSchema>

/** Ops that create SVG elements (vs timeline/narration). */
export const DRAWING_OP_NAMES = [
  'line',
  'circle',
  'rect',
  'polygon',
  'arrow',
  'path',
  'text',
  'equation',
  'point',
] as const

// ---------------------------------------------------------------------------
// Root payload
// ---------------------------------------------------------------------------

export const GuidedExplanationV2Schema = z
  .object({
    version: z.literal('guided-explanation/v2'),
    title: z.string().min(1).max(200),
    subtitle: z.string().max(400).optional(),
    direction: z.enum(['ltr', 'rtl']),
    locale: z.enum(['he', 'en']),
    canvas: z
      .object({
        width: z.number().positive().max(2000),
        height: z.number().positive().max(2000),
      })
      .passthrough(),
    controls: z
      .object({
        playLabel: z.string().min(1).max(64),
        resetLabel: z.string().min(1).max(64),
      })
      .passthrough(),
    narrationBox: z
      .object({
        placeholder: z.string().min(1).max(400),
      })
      .passthrough(),
    ops: z.array(OpSchema).min(1).max(500),
  })
  .passthrough()

export type GuidedExplanationV2 = z.infer<typeof GuidedExplanationV2Schema>
