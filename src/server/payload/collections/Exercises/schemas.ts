import { z } from 'zod'

// Use shared types for API surface (matching client)
// Zod schemas are used for validation only
export type LatexBlock = import('./types').LatexBlock
export type ContentData = import('./types').ContentData

// Import graphics contracts for Geometry and Axis schemas
import { AxisSpecV1Schema } from '@/infra/contracts/graphics/axis.v1'
import { GeometrySpecV1Schema } from '@/infra/contracts/graphics/geometry.v1'
import { GuidedExplanationV1Schema } from '@/infra/contracts/guided-explanation/v1'

// ---------------------------------
// Zod: Inline Rich Text (NO id)
// ---------------------------------
const InlineRichTextSchema = z
  .object({
    type: z.literal('rich_text'),
    format: z.literal('md-math-v1'),
    value: z.string(),
    mediaIds: z.array(z.string().min(1)).default([]),
  })
  .strict()

// ---------------------------------
// Zod: Stream Rich Text Block (has id)
// ---------------------------------
export const RichTextBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('rich_text'),
    format: z.literal('md-math-v1'),
    value: z.string(),
    mediaIds: z.array(z.string().min(1)).default([]),
  })
  .strict()

// ---------------------------------
// Zod: Answer schemas by question type
// ---------------------------------

export const TrueFalseAnswerSchema = z
  .object({
    correctOptionId: z.string().optional(),
  })
  .strict()

const McqOptionSchema = z
  .object({
    id: z.string().min(1),
    // single rich_text per option
    content: InlineRichTextSchema,
  })
  .strict()

export const McqAnswerSchema = z
  .object({
    multiSelect: z.boolean().default(false),
    options: z.array(McqOptionSchema).min(2),
    correctOptionIds: z.array(z.string().min(1)).min(1),
  })
  .strict()
  .superRefine((ans, ctx) => {
    const optionIds = new Set(ans.options.map((o) => o.id))
    const missing = ans.correctOptionIds.filter((id) => !optionIds.has(id))
    if (missing.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `correctOptionIds contains unknown option ids: ${missing.join(', ')}`,
        path: ['correctOptionIds'],
      })
    }
    if (!ans.multiSelect && ans.correctOptionIds.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'When multiSelect=false, correctOptionIds must contain exactly 1 id.',
        path: ['correctOptionIds'],
      })
    }
  })

export const FreeResponseAnswerSchema = z
  .object({
    acceptedAnswers: z.array(z.string().min(1)).min(1),
  })
  .strict()

// ---------------------------------
// Zod: Question blocks
// ---------------------------------

// True/False variant of question_select
const QuestionSelectTrueFalseSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('question_select'),
    variant: z.literal('true_false'),
    selectionMode: z.literal('single'),
    prompt: InlineRichTextSchema,
    options: z.tuple([
      z.object({
        id: z.literal('true'),
        value: z.literal(true),
        label: InlineRichTextSchema,
      }),
      z.object({
        id: z.literal('false'),
        value: z.literal(false),
        label: InlineRichTextSchema,
      }),
    ]),
    answer: TrueFalseAnswerSchema,

    hint: InlineRichTextSchema.optional(),
    solution: InlineRichTextSchema.optional(),
    fullSolution: InlineRichTextSchema.optional(),
  })
  .strict()

// MCQ variant of question_select
const QuestionSelectMcqSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('question_select'),
    variant: z.literal('mcq'),
    selectionMode: z.enum(['single', 'multiple']),
    prompt: InlineRichTextSchema,
    answer: McqAnswerSchema,

    hint: InlineRichTextSchema.optional(),
    solution: InlineRichTextSchema.optional(),
    fullSolution: InlineRichTextSchema.optional(),
  })
  .strict()

// Union of all question_select variants
export const QuestionSelectBlockSchema = z.discriminatedUnion('variant', [
  QuestionSelectTrueFalseSchema,
  QuestionSelectMcqSchema,
])

export const QuestionFreeResponseBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('question_free_response'),
    prompt: InlineRichTextSchema,
    answer: FreeResponseAnswerSchema,

    hint: InlineRichTextSchema.optional(),
    solution: InlineRichTextSchema.optional(),
    fullSolution: InlineRichTextSchema.optional(),
  })
  .strict()

// ---------------------------------
// Zod: Latex Block
// ---------------------------------
const LatexBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('latex'),
    latex: z.string().min(1),
    renderMode: z.enum(['block', 'inline']).default('block'),
  })
  .strict()

// ---------------------------------
// Zod: Table Answer Schema
// ---------------------------------
const TableAnswerSchema = z
  .record(z.string(), z.string())
  .refine((answers) => {
    const keyRegex = /^\d+-\d+$/
    for (const key of Object.keys(answers)) {
      if (!keyRegex.test(key)) {
        return false
      }
    }
    return true
  }, 'Answer keys must be in format "rowIdx-colIdx" (e.g., "0-1")')
  .optional()

// ---------------------------------
// Zod: Table Block
// ---------------------------------
const TableBlockSchema = z
  .object({
    solutionFill: z.boolean().default(false),
    headers: z.array(z.string()).min(1),
    rowsData: z.array(z.array(z.string())).min(1),
    answers: TableAnswerSchema,
    showBorders: z.boolean().default(true),
    showHeader: z.boolean().default(true),
    columnAlignment: z.array(z.enum(['left', 'center', 'right'])).optional(),
  })
  .strict()
  .superRefine((table, ctx) => {
    const headerCount = table.headers.length

    for (let rowIdx = 0; rowIdx < table.rowsData.length; rowIdx++) {
      const row = table.rowsData[rowIdx]
      if (row.length !== headerCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Row ${rowIdx} has ${row.length} cells, but headers define ${headerCount} columns`,
          path: ['rowsData', rowIdx],
        })
      }
    }

    if (table.columnAlignment && table.columnAlignment.length !== headerCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `columnAlignment has ${table.columnAlignment.length} items, but headers define ${headerCount} columns`,
        path: ['columnAlignment'],
      })
    }

    // Validate answer keys are within table bounds
    for (const [key] of Object.entries(table.answers || {})) {
      const [rowIdx, colIdx] = key.split('-').map(Number)

      if (rowIdx >= table.rowsData.length || colIdx >= headerCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Answer key "${key}" references out-of-bounds cell`,
          path: ['answers', key],
        })
      }
    }
  })

// ---------------------------------
// Zod: Question Table Block
// ---------------------------------
export const QuestionTableBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('question_table'),
    prompt: InlineRichTextSchema,
    table: TableBlockSchema,
    hint: InlineRichTextSchema.optional(),
    solution: InlineRichTextSchema.optional(),
    fullSolution: InlineRichTextSchema.optional(),
  })
  .strict()

// ---------------------------------
// Zod: Matching Option Schema
// ---------------------------------
const MatchingOptionSchema = z
  .object({
    id: z.string().min(1),
    content: InlineRichTextSchema,
  })
  .strict()

// ---------------------------------
// Zod: Matching Pair Schema (answer)
// ---------------------------------
const MatchingPairSchema = z
  .object({
    optionId: z.string().min(1),
    matchId: z.string().min(1),
  })
  .strict()

// ---------------------------------
// Zod: Question Matching Block Schema
// ---------------------------------
export const QuestionMatchingBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('question_matching'),
    prompt: InlineRichTextSchema,
    leftColumn: z.array(MatchingOptionSchema).min(2),
    rightColumn: z.array(MatchingOptionSchema).min(2),
    correctPairs: z.array(MatchingPairSchema).min(1),
    shuffleRightColumn: z.boolean().default(true),
    hint: InlineRichTextSchema.optional(),
    solution: InlineRichTextSchema.optional(),
    fullSolution: InlineRichTextSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    // Validate all option IDs exist in their respective columns
    const leftIds = new Set(data.leftColumn.map((o) => o.id))
    const rightIds = new Set(data.rightColumn.map((o) => o.id))

    for (const pair of data.correctPairs) {
      if (!leftIds.has(pair.optionId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `correctPairs contains unknown optionId: ${pair.optionId}`,
          path: ['correctPairs'],
        })
      }
      if (!rightIds.has(pair.matchId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `correctPairs contains unknown matchId: ${pair.matchId}`,
          path: ['correctPairs'],
        })
      }
    }
  })

// ---------------------------------
// Zod: SVG Hotspot Schema
// ---------------------------------
const SvgHotspotSchema = z
  .object({
    id: z.string().min(1),
    selector: z.string().min(1),
    label: z.string().optional(),
  })
  .strict()

// ---------------------------------
// Zod: SVG Block Schema
// ---------------------------------
const SvgBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('svg'),
    value: z.string().min(1),
    altText: z.string().optional(),
    caption: InlineRichTextSchema.optional(),
    interactive: z.boolean().optional(),
    hotspots: z.array(SvgHotspotSchema).optional(),
    correctHotspotIds: z.array(z.string().min(1)).optional(),
    hint: InlineRichTextSchema.optional(),
    solution: InlineRichTextSchema.optional(),
    fullSolution: InlineRichTextSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.correctHotspotIds && data.hotspots) {
      const hotspotIds = new Set(data.hotspots.map((h) => h.id))
      for (const id of data.correctHotspotIds) {
        if (!hotspotIds.has(id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `correctHotspotIds contains unknown hotspot id: ${id}`,
            path: ['correctHotspotIds'],
          })
        }
      }
    }
    if (data.interactive && (!data.hotspots || data.hotspots.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Interactive SVG must have at least one hotspot',
        path: ['hotspots'],
      })
    }
  })

// ---------------------------------
// Zod: Question Answer Schema (used by Geometry + Axis)
// ---------------------------------
const QuestionAnswerSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('numeric'),
      value: z.number(),
      tolerance: z.number().positive().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('mcq'),
      options: z.array(McqOptionSchema).min(2),
      correctOptionIds: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('free_response'),
      acceptedAnswers: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('point'),
      x: z.number(),
      y: z.number(),
      tolerance: z.number().positive().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('function'),
      acceptedExpressions: z.array(z.string().min(1)).min(1),
    })
    .strict(),
])

// ---------------------------------
// Zod: Graph Layout Enum
// ---------------------------------
const GraphLayoutSchema = z
  .enum(['textAbove', 'textBelow', 'textLeft', 'textRight'])
  .default('textRight')

// ---------------------------------
// Zod: Question Geometry Block Schema
// ---------------------------------
export const QuestionGeometryBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('question_geometry'),
    prompt: InlineRichTextSchema,
    layout: GraphLayoutSchema,
    geometry: GeometrySpecV1Schema,
    answer: QuestionAnswerSchema.optional(),
    hint: InlineRichTextSchema.optional(),
    solution: InlineRichTextSchema.optional(),
    fullSolution: InlineRichTextSchema.optional(),
  })
  .strict()

// ---------------------------------
// Zod: Display Size Enum (for graph width control)
// ---------------------------------
const DisplaySizeSchema = z.enum(['small', 'medium', 'large', 'full']).default('full').optional()

// ---------------------------------
// Zod: Question Axis Block Schema
// ---------------------------------
export const QuestionAxisBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('question_axis'),
    prompt: InlineRichTextSchema,
    layout: GraphLayoutSchema,
    axis: AxisSpecV1Schema,
    displaySize: DisplaySizeSchema,
    answer: QuestionAnswerSchema.optional(),
    hint: InlineRichTextSchema.optional(),
    solution: InlineRichTextSchema.optional(),
    fullSolution: InlineRichTextSchema.optional(),
  })
  .strict()

// ---------------------------------
// Zod: Multi-Axis Graph Item Schema (single graph within multi-axis block)
// ---------------------------------
const MultiAxisGraphItemSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    axis: AxisSpecV1Schema,
    order: z.number().int().min(0),
  })
  .strict()

// ---------------------------------
// Zod: Question Multi-Axis Block Schema (multiple graphs in one block)
// ---------------------------------
export const QuestionMultiAxisBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('question_multi_axis'),
    prompt: InlineRichTextSchema.optional(),
    textPosition: z.enum(['above', 'below']).default('above'),
    columnsPerRow: z.union([z.literal(1), z.literal(2), z.literal(4)]).optional(),
    graphs: z.array(MultiAxisGraphItemSchema).min(1).max(4),
  })
  .strict()
  .superRefine((data, ctx) => {
    // Validate unique graph IDs
    const graphIds = data.graphs.map((g) => g.id)
    const uniqueIds = new Set(graphIds)
    if (uniqueIds.size !== graphIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Graph IDs must be unique within the multi-axis block',
        path: ['graphs'],
      })
    }
  })

// ---------------------------------
// Zod: HTML Block (WYSIWYG content stored as sanitized HTML string)
// ---------------------------------

// Allowlist of tags Quill can produce + safe formatting tags
const HTML_ALLOWED_TAGS = new Set([
  'p',
  'br',
  'hr',
  'span',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'del',
  'ins',
  'mark',
  'sub',
  'sup',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'a',
  'img',
  'div',
  'section',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
])

// Patterns that are dangerous regardless of tag allowlist
const DANGEROUS_HTML_PATTERNS = [
  /\bon\w+\s*=/i, // inline event handlers (onclick, onload, etc.)
  /javascript\s*:/i, // javascript: URLs
  /vbscript\s*:/i, // vbscript: URLs
  /data\s*:[^,]*;base64/i, // data: URIs with base64 (in href/src context)
]

function validateHtmlTags(html: string): boolean {
  const tagPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi
  let match
  while ((match = tagPattern.exec(html)) !== null) {
    if (!HTML_ALLOWED_TAGS.has(match[1].toLowerCase())) {
      return false
    }
  }
  return true
}

export const HtmlBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('html'),
    html: z
      .string()
      .refine(
        (html) => validateHtmlTags(html),
        'HTML contains disallowed tags. Only safe formatting tags are permitted.',
      )
      .refine(
        (html) => !DANGEROUS_HTML_PATTERNS.some((pattern) => pattern.test(html)),
        'HTML contains blocked content (event handlers, javascript:, vbscript:, or data: URLs)',
      ),
    /**
     * When present, the block renders a GuidedExplanationRunner (trusted
     * engine) instead of static HTML. Gemini sends this as structured JSON
     * — the scripts are ours, Gemini only sends parameters.
     */
    guidedExplanation: GuidedExplanationV1Schema.optional(),
  })
  .strict()

// ---------------------------------
// Zod: Media Block (reference to a single media item)
// ---------------------------------
export const MediaBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('media'),
    mediaId: z.string().min(1),
  })
  .strict()

// ---------------------------------
// Zod: Content union (exported for admin components)
// ---------------------------------
export const ContentBlockSchema = z.discriminatedUnion('type', [
  RichTextBlockSchema,
  QuestionSelectBlockSchema,
  QuestionFreeResponseBlockSchema,
  LatexBlockSchema,
  QuestionTableBlockSchema,
  QuestionMatchingBlockSchema,
  SvgBlockSchema,
  QuestionGeometryBlockSchema,
  QuestionAxisBlockSchema,
  QuestionMultiAxisBlockSchema,
  HtmlBlockSchema,
  MediaBlockSchema,
])

export type ContentBlock = z.infer<typeof ContentBlockSchema>

export type QuestionTableBlock = z.infer<typeof QuestionTableBlockSchema>

export const ContentSchema = z
  .object({
    blocks: z.array(ContentBlockSchema).min(1),
  })
  .strict()

export type ExerciseContent = z.infer<typeof ContentSchema>
