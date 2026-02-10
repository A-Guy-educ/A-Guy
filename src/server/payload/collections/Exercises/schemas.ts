import { z } from 'zod'

// Use shared types for API surface (matching client)
// Zod schemas are used for validation only
export type ContentBlock = import('@/shared/exercise-content/types').ContentBlock
export type LatexBlock = import('@/shared/exercise-content/types').LatexBlock
export type ContentData = import('@/shared/exercise-content/types').ContentData

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
// Zod: Content union (validation only - use shared types for API)
// ---------------------------------
const ContentBlockSchema = z.discriminatedUnion('type', [
  RichTextBlockSchema,
  QuestionSelectBlockSchema,
  QuestionFreeResponseBlockSchema,
  LatexBlockSchema,
])

export const ContentSchema = z
  .object({
    blocks: z.array(ContentBlockSchema).min(1),
  })
  .strict()

export type ExerciseContent = z.infer<typeof ContentSchema>
