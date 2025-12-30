import { z } from 'zod'
import { BlockIdSchema } from '../primitives'
import { AxisSpecV1Schema } from '../graphics/axis.v1'
import { GeometrySpecV1Schema } from '../graphics/geometry.v1'

/**
 * Exercise content blocks - Discriminated union by 'type'
 * Each block has an 'id' for stable React keys and editor operations
 */

/** Rich text block (Math-aware Markdown) */
const RichTextBlockSchema = z
  .object({
    id: BlockIdSchema,
    type: z.literal('rich_text'),
    format: z.literal('md-math-v1'),
    value: z.string().min(1),
  })
  .strict()

/** Table block */
const TableBlockSchema = z
  .object({
    id: BlockIdSchema,
    type: z.literal('table'),
    headers: z.array(z.string()),
    rows: z.array(z.array(z.string())),
    showBorders: z.boolean(),
    showHeader: z.boolean(),
    columnAlignment: z.array(z.enum(['left', 'center', 'right'])),
  })
  .strict()
  .superRefine((data, ctx) => {
    // Optionally validate each row has same length as headers
    // Keeping permissive for v1, but document the check
    for (let i = 0; i < data.rows.length; i++) {
      if (data.rows[i].length !== data.headers.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Row ${i} has ${data.rows[i].length} columns but headers has ${data.headers.length}`,
          path: ['rows', i],
        })
      }
    }
  })

/** SVG block (static SVG content) */
const SvgBlockSchema = z
  .object({
    id: BlockIdSchema,
    type: z.literal('svg'),
    svg: z.string().min(1),
  })
  .strict()

/** Axis system block (spec JSON) */
const AxisSystemBlockSchema = z
  .object({
    id: BlockIdSchema,
    type: z.literal('axis_system'),
    specVersion: z.literal(1),
    spec: AxisSpecV1Schema,
  })
  .strict()

/** Geometry block (spec JSON) */
const GeometryBlockSchema = z
  .object({
    id: BlockIdSchema,
    type: z.literal('geometry'),
    specVersion: z.literal(1),
    spec: GeometrySpecV1Schema,
  })
  .strict()

/** Discriminated union of all exercise blocks */
export const ExerciseBlockSchema = z.discriminatedUnion('type', [
  RichTextBlockSchema,
  TableBlockSchema,
  SvgBlockSchema,
  AxisSystemBlockSchema,
  GeometryBlockSchema,
])

/** Inferred TypeScript types */
export type RichTextBlock = z.infer<typeof RichTextBlockSchema>
export type TableBlock = z.infer<typeof TableBlockSchema>
export type SvgBlock = z.infer<typeof SvgBlockSchema>
export type AxisSystemBlock = z.infer<typeof AxisSystemBlockSchema>
export type GeometryBlock = z.infer<typeof GeometryBlockSchema>
export type ExerciseBlock = z.infer<typeof ExerciseBlockSchema>
