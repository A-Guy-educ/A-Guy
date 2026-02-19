import { z } from 'zod'

// Use shared types for API surface (matching client)
// Zod schemas are used for validation only
export type LatexBlock = import('@/shared/exercise-content/types').LatexBlock
export type ContentData = import('@/shared/exercise-content/types').ContentData

// Sanitization utility for HTML blocks
import { sanitizeHtml } from '@/infra/utils/sanitize-html'

// Import graphics contracts for Geometry and Axis schemas
import { AxisSpecV1Schema } from '@/infra/contracts/graphics/axis.v1'
import { GeometrySpecV1Schema } from '@/infra/contracts/graphics/geometry.v1'

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
// Zod: SVG Block Schema
// ---------------------------------
const SvgBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('svg'),
    value: z.string().min(1), // SVG content
    altText: z.string().optional(),
    caption: InlineRichTextSchema.optional(),
  })
  .strict()

// ---------------------------------
// Zod: HTML Block Schema (Quill WYSIWYG)
// ---------------------------------
export const HtmlBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('html'),
    html: z
      .string()
      .min(1, 'HTML content is required')
      .transform((val) => sanitizeHtml(val)), // server-side defense-in-depth
  })
  .strict()

// ---------------------------------
// Zod: Question Geometry Block Schema
// ---------------------------------
export const QuestionGeometryBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('question_geometry'),
    prompt: InlineRichTextSchema,
    geometry: GeometrySpecV1Schema,
    hint: InlineRichTextSchema.optional(),
    solution: InlineRichTextSchema.optional(),
    fullSolution: InlineRichTextSchema.optional(),
  })
  .strict()

// ---------------------------------
// Zod: Question Axis Block Schema
// ---------------------------------
export const QuestionAxisBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('question_axis'),
    prompt: InlineRichTextSchema,
    axis: AxisSpecV1Schema,
    hint: InlineRichTextSchema.optional(),
    solution: InlineRichTextSchema.optional(),
    fullSolution: InlineRichTextSchema.optional(),
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
  HtmlBlockSchema,
  QuestionGeometryBlockSchema,
  QuestionAxisBlockSchema,
])

export type ContentBlock = z.infer<typeof ContentBlockSchema>

export type QuestionTableBlock = z.infer<typeof QuestionTableBlockSchema>

export const ContentSchema = z
  .object({
    blocks: z.array(ContentBlockSchema).min(1),
  })
  .strict()

export type ExerciseContent = z.infer<typeof ContentSchema>
