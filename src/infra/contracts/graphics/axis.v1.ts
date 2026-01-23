import { z } from 'zod'
import { ColorStringSchema, LineStyleSchema, PositionEnumSchema } from '../primitives'
import { InteractionToolSchema, EvaluationModeSchema } from './interaction.base'

/**
 * AxisSpecV1 - Declarative JSON specification for axis/graph systems
 * Version 1 - Supports cartesian coordinate systems with graphs, points, painting, etc.
 */

/** Grid configuration */
const GridSchema = z.object({
  enabled: z.boolean(),
  color: ColorStringSchema.optional(),
})

/** Axes configuration */
const AxesSchema = z.object({
  axisColor: ColorStringSchema.optional(),
  numberColor: ColorStringSchema.optional(),
  labelColor: ColorStringSchema.optional(),
  showNumbers: z.boolean(),
  showLabels: z.boolean(),
  ticks: z.number().int().min(0),
  labels: z.object({
    x: z.string(),
    y: z.string(),
  }),
  origin: z.object({
    x: z.number(),
    y: z.number(),
  }),
})

/** Viewport bounds (optional) */
const ViewportSchema = z
  .object({
    xMin: z.number().optional(),
    xMax: z.number().optional(),
    yMin: z.number().optional(),
    yMax: z.number().optional(),
  })
  .optional()

/** Point element */
const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
  label: z.string().optional(),
  type: z.enum(['point', 'hole', 'floating_text']),
  color: ColorStringSchema.optional(),
  labelPosition: PositionEnumSchema.optional(),
})

/** Integral/area paint range */
const PaintRangeSchema = z.object({
  fromX: z.number(),
  toX: z.number(),
  fillColor: ColorStringSchema.optional(),
})

/** Graph element */
const GraphSchema = z.object({
  id: z.string(),
  fn: z.string().min(1), // e.g., "2*x^2+3"
  style: LineStyleSchema,
  thickness: z.number().positive(),
  color: ColorStringSchema.optional(),
  range: z
    .object({
      fromX: z.number().nullable().optional(),
      toX: z.number().nullable().optional(),
    })
    .optional(),
  paint: z
    .object({
      integral: z.array(PaintRangeSchema).optional(),
      underGraph: z.array(PaintRangeSchema).optional(),
      aboveGraph: z.array(PaintRangeSchema).optional(),
    })
    .optional(),
})

/** Paint between two graphs */
const PaintBetweenGraphsSchema = z.object({
  firstGraphId: z.string(),
  secondGraphId: z.string(),
  fromX: z.number(),
  toX: z.number(),
  fillColor: ColorStringSchema.optional(),
})

/** Line between two points */
const LineBetweenPointsSchema = z.object({
  style: LineStyleSchema,
  thickness: z.number().positive(),
  a: z.object({
    x: z.number(),
    y: z.number(),
  }),
  b: z.object({
    x: z.number(),
    y: z.number(),
  }),
  color: ColorStringSchema.optional(),
})

/** Geometric locus (implicit curve) */
const GeometricLocusSchema = z.object({
  equation: z.string().min(1),
  style: LineStyleSchema,
  thickness: z.number().positive(),
  color: ColorStringSchema.optional(),
})

/** Elements collection */
const ElementsSchema = z.object({
  points: z.array(PointSchema),
  graphs: z.array(GraphSchema),
  asymptotesVertical: z.array(z.number()).optional(),
  asymptotesHorizontal: z.array(z.number()).optional(),
  paintBetweenGraphs: z.array(PaintBetweenGraphsSchema).optional(),
  lineBetweenPoints: z.array(LineBetweenPointsSchema).optional(),
  geometricLoci: z.array(GeometricLocusSchema).optional(),
})

/** Interaction specification (future Drawing Response) */
const InteractionSpecSchema = z
  .object({
    enabled: z.boolean(),
    toolsAllowed: z.array(InteractionToolSchema),
    constraints: z
      .object({
        snapToGrid: z.boolean().optional(),
        bounds: z
          .object({
            xMin: z.number(),
            xMax: z.number(),
            yMin: z.number(),
            yMax: z.number(),
          })
          .strict()
          .optional(),
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

/** AxisSpecV1 - Main schema */
export const AxisSpecV1Schema = z
  .object({
    kind: z.literal('cartesian'),
    units: z.number().positive(),
    grid: GridSchema,
    axes: AxesSchema,
    viewport: ViewportSchema,
    elements: ElementsSchema,
    interactionSpec: InteractionSpecSchema,
  })
  .strict()

/** Inferred TypeScript type */
export type AxisSpecV1 = z.infer<typeof AxisSpecV1Schema>
