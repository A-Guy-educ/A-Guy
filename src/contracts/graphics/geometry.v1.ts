import { z } from 'zod'
import { ColorStringSchema, PositionEnumSchema } from '../primitives'
import { InteractionToolSchema, EvaluationModeSchema } from './interaction.base'

/**
 * GeometrySpecV1 - Declarative JSON specification for Euclidean geometry
 * Version 1 - Supports points, lines, circles, angles, vectors, areas, etc.
 */

/** Canvas configuration */
const CanvasSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  background: ColorStringSchema.optional(),
  grid: z.boolean().optional(),
})

/** Point element */
const GeometryPointSchema = z.object({
  name: z.string(),
  x: z.number(),
  y: z.number(),
  position: PositionEnumSchema.optional(),
  fontSize: z.number().positive().optional(),
  visible: z.boolean().optional(),
})

/** Line label */
const LineLabelSchema = z.object({
  value: z.string().optional(),
  position: z.enum(['t', 'b', 'm']),
  fontSize: z.number().positive().optional(),
})

/** Line element */
const LineSchema = z.object({
  from: z.string(),
  to: z.string(),
  style: z.enum(['solid', 'dashed']),
  thickness: z.number().positive().optional(),
  color: ColorStringSchema.optional(),
  label: LineLabelSchema.optional(),
})

/** Circle element */
const CircleSchema = z.object({
  center: z.string(),
  through: z.string().optional(),
  radius: z.number().positive().optional(),
  style: z.enum(['solid', 'dashed']),
  color: ColorStringSchema.optional(),
})

/** Angle label */
const AngleLabelSchema = z.object({
  value: z.string().optional(),
  position: z.enum(['inside', 'outside']),
  fontSize: z.number().positive().optional(),
})

/** Angle element */
const AngleSchema = z.object({
  center: z.string(),
  ray1: z.string(),
  ray2: z.string(),
  arcRadius: z.number().positive().optional(),
  color: ColorStringSchema.optional(),
  style: z.enum(['arc', 'square']).optional(),
  label: AngleLabelSchema.optional(),
})

/** Vector element */
const VectorSchema = z.object({
  from: z.string(),
  to: z.string(),
  color: ColorStringSchema.optional(),
  thickness: z.number().positive().optional(),
  style: z.enum(['solid', 'dashed']).optional(),
})

/** Area element (polygon shading) */
const AreaSchema = z.object({
  polygon: z.array(z.string()).min(3), // At least 3 points for a polygon
  style: z.enum(['hatch', 'solid']).optional(),
  color: ColorStringSchema.optional(),
})

/** Rectangle element */
const RectangleSchema = z.object({
  points: z.array(z.string()).length(4), // Exactly 4 points
  style: z.enum(['solid', 'dashed']).optional(),
  thickness: z.number().positive().optional(),
  color: ColorStringSchema.optional(),
  fill: ColorStringSchema.optional(),
})

/** Triangle element */
const TriangleSchema = z.object({
  points: z.array(z.string()).length(3), // Exactly 3 points
  style: z.enum(['solid', 'dashed']).optional(),
  thickness: z.number().positive().optional(),
  color: ColorStringSchema.optional(),
  fill: ColorStringSchema.optional(),
})

/** Text element */
const TextSchema = z.object({
  value: z.string(),
  on: z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .optional(),
  place: z
    .object({
      x: z.number().optional(),
      y: z.number().optional(),
    })
    .optional(),
  position: PositionEnumSchema.optional(),
  fontSize: z.number().positive().optional(),
})

/** Equal segment marker (array of segments that are equal to each other) */
const EqualSegmentGroupSchema = z.array(
  z.object({
    from: z.string(),
    to: z.string(),
  }),
)

/** Tangent element */
const TangentSchema = z.object({
  type: z.enum(['external_point', 'at_point', 'common']),
  circle: z.string().optional(),
  point: z.string().optional(),
  circles: z.array(z.string()).optional(),
  position: z.enum(['external', 'internal']).optional(),
  style: z.enum(['solid', 'dashed']).optional(),
  color: ColorStringSchema.optional(),
})

/** Elements collection */
const GeometryElementsSchema = z.object({
  points: z.array(GeometryPointSchema),
  lines: z.array(LineSchema),
  circles: z.array(CircleSchema),
  angles: z.array(AngleSchema),
  vectors: z.array(VectorSchema).optional(),
  areas: z.array(AreaSchema).optional(),
  rectangles: z.array(RectangleSchema).optional(),
  triangles: z.array(TriangleSchema).optional(),
  texts: z.array(TextSchema).optional(),
  equalSegments: z.array(EqualSegmentGroupSchema).optional(),
  equalAngles: z.array(z.array(z.number().int().nonnegative())).optional(), // Indices into angles array
  tangents: z.array(TangentSchema).optional(),
})

/** Interaction specification (future) */
const GeometryInteractionSpecSchema = z
  .object({
    enabled: z.boolean(),
    toolsAllowed: z.array(InteractionToolSchema),
    constraints: z
      .object({
        snapToGrid: z.boolean().optional(),
        maxPoints: z.number().int().positive().optional(),
      })
      .strict()
      .optional(),
    evaluation: z
      .object({
        mode: EvaluationModeSchema,
        rules: z.array(z.unknown()).optional(), // Placeholder for future grading rules
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional()

/** GeometrySpecV1 - Main schema */
export const GeometrySpecV1Schema = z
  .object({
    kind: z.literal('euclidean'),
    canvas: CanvasSchema,
    elements: GeometryElementsSchema,
    interactionSpec: GeometryInteractionSpecSchema,
  })
  .strict()

/** Inferred TypeScript type */
export type GeometrySpecV1 = z.infer<typeof GeometrySpecV1Schema>
