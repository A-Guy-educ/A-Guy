import { z } from 'zod'

// ---------------------------------
// Zod: Inline Rich Text (NO id)
// ---------------------------------
export const InlineRichTextSchema = z
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

// True/False option schema (fixed structure)
const TrueFalseOptionSchema = z
  .object({
    id: z.enum(['true', 'false']),
    value: z.boolean(),
    label: InlineRichTextSchema,
  })
  .strict()

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
    responseKind: z.enum(['numeric', 'text']),
    acceptedAnswers: z.array(z.string().min(1)).min(1),
    tolerance: z.number().min(0).default(0),
  })
  .strict()
  .superRefine((ans, ctx) => {
    if (ans.responseKind !== 'numeric' && ans.tolerance !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'tolerance is only allowed for numeric responses (set it to 0 for text).',
        path: ['tolerance'],
      })
    }
  })

// ---------------------------------
// Zod: Question blocks
// ---------------------------------
export const QuestionSelectBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('question_select'),
    variant: z.enum(['true_false']),
    selectionMode: z.enum(['single']),
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

export const QuestionMcqBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('question_mcq'),
    prompt: InlineRichTextSchema,
    answer: McqAnswerSchema,

    hint: InlineRichTextSchema.optional(),
    solution: InlineRichTextSchema.optional(),
    fullSolution: InlineRichTextSchema.optional(),
  })
  .strict()

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
// Zod: Content union (exported for admin components)
// ---------------------------------
export const ContentBlockSchema = z.discriminatedUnion('type', [
  RichTextBlockSchema,
  QuestionSelectBlockSchema,
  QuestionMcqBlockSchema,
  QuestionFreeResponseBlockSchema,
])

export type ContentBlock = z.infer<typeof ContentBlockSchema>

export const ContentSchema = z
  .object({
    blocks: z.array(ContentBlockSchema).min(1),
  })
  .strict()

export type ExerciseContent = z.infer<typeof ContentSchema>
