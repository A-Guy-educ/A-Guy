import type { CollectionConfig, Access } from 'payload'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { createdByField } from '../fields/createdBy'

const isAdminOrOwner: Access = ({ req }) => {
  const user = req.user
  if (!user) return false

  // Admin
  if ((user as any).role === 'admin') return true

  // Owner
  return {
    owner: {
      equals: (user as any).id,
    },
  }
}

/**
 * Exercises Collection — Block-based content (correct model)
 *
 * Rule:
 * - content.blocks is a single ordered stream.
 * - Any question is a block type inside the stream.
 *
 * Therefore:
 * - NO exercise-level questionType
 * - NO exercise-level answerSpecJson
 * - Each question block owns:
 *   - prompt (required)
 *   - answer (required)        <-- ONLY grading data
 *   - hint/solution/fullSolution (optional)  <-- teacher/explanation data
 */

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

export type InlineRichText = z.infer<typeof InlineRichTextSchema>

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
const TrueFalseAnswerSchema = z
  .object({
    correct: z.boolean(),
  })
  .strict()

export const McqOptionSchema = z
  .object({
    id: z.string().min(1),
    // single rich_text per option
    content: InlineRichTextSchema,
  })
  .strict()

export type McqOption = z.infer<typeof McqOptionSchema>

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

export type McqAnswer = z.infer<typeof McqAnswerSchema>

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

export type FreeResponseAnswer = z.infer<typeof FreeResponseAnswerSchema>

// ---------------------------------
// Zod: Question blocks
// ---------------------------------
const QuestionTrueFalseBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('question_true_false'),
    prompt: InlineRichTextSchema,
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

export type QuestionMcqBlock = z.infer<typeof QuestionMcqBlockSchema>

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

export type QuestionFreeResponseBlock = z.infer<typeof QuestionFreeResponseBlockSchema>

// ---------------------------------
// Zod: Content union
// ---------------------------------
const ContentBlockSchema = z.discriminatedUnion('type', [
  RichTextBlockSchema,
  QuestionTrueFalseBlockSchema,
  QuestionMcqBlockSchema,
  QuestionFreeResponseBlockSchema,
])

const ContentSchema = z
  .object({
    blocks: z.array(ContentBlockSchema).min(1),
  })
  .strict()

// ---------------------------------
// Defaults
// ---------------------------------
const DEFAULT_CONTENT = () => ({
  blocks: [
    {
      id: randomUUID(),
      type: 'rich_text' as const,
      format: 'md-math-v1' as const,
      value: 'Write the exercise instructions here.',
      mediaIds: [] as string[],
    },
  ],
})

// ✅ FIX: TF "answer" is ONLY grading data (single question per block)
const DEFAULT_TF_ANSWER = {
  correct: true,
} as const

const DEFAULT_MCQ_ANSWER = {
  multiSelect: false,
  options: [
    {
      id: 'o1',
      content: { type: 'rich_text', format: 'md-math-v1', value: 'Option A', mediaIds: [] },
    },
    {
      id: 'o2',
      content: { type: 'rich_text', format: 'md-math-v1', value: 'Option B', mediaIds: [] },
    },
  ],
  correctOptionIds: ['o1'],
} as const

const DEFAULT_FREE_RESPONSE_ANSWER = {
  responseKind: 'numeric',
  acceptedAnswers: ['4'],
  tolerance: 0,
} as const

// ---------------------------------
// Collection
// ---------------------------------
export const Exercises: CollectionConfig = {
  slug: 'exercises',
  access: {
    create: authenticated,
    delete: isAdminOrOwner,
    read: anyone,
    update: isAdminOrOwner,
  },

  admin: {
    useAsTitle: 'title',
    defaultColumns: ['order', 'title', 'lesson', 'updatedAt'],
  },

  fields: [
    // Section 1: Exercise Meta (Basics)
    {
      type: 'collapsible',
      label: 'Exercise Meta (Basics)',
      admin: { initCollapsed: false },
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          admin: { description: 'Exercise title (for admin reference)' },
        },
        {
          name: 'order',
          type: 'number',
          required: true,
          defaultValue: 0,
          admin: {
            description: 'Order of exercise within the lesson (lower numbers appear first)',
          },
        },
        {
          name: 'lesson',
          type: 'relationship',
          relationTo: 'lessons',
          required: true,
          index: true,
          admin: { description: 'The lesson this exercise belongs to' },
        },
      ],
    },

    // Section 2: Content
    {
      type: 'collapsible',
      label: 'Content',
      admin: { initCollapsed: false },
      fields: [
        {
          name: 'content',
          type: 'json',
          required: true,
          defaultValue: DEFAULT_CONTENT,
          validate: (value: unknown) => {
            const result = ContentSchema.safeParse(value)
            if (result.success) return true
            return 'Invalid content. Expected: { blocks: (rich_text | question_true_false | question_mcq | question_free_response)[] }.'
          },
          admin: {
            description:
              'Ordered blocks stream. Use question_* blocks to add questions, and rich_text blocks for instructions/notes between questions.',
            components: {
              Field: '@/components/admin/ExerciseContentEditor#ExerciseContentEditor',
            },
          },
        },
      ],
    },

    // Created By
    createdByField,
  ],
}

// ---------------------------------
// Block factories for editor UI (Add Block menu)
// ---------------------------------
export const ExerciseBlockDefaults = {
  rich_text: () => ({
    id: randomUUID(),
    type: 'rich_text' as const,
    format: 'md-math-v1' as const,
    value: 'Write text here.',
    mediaIds: [] as string[],
  }),

  question_true_false: () => ({
    id: randomUUID(),
    type: 'question_true_false' as const,
    prompt: {
      type: 'rich_text' as const,
      format: 'md-math-v1' as const,
      value: 'Statement: ...',
      mediaIds: [] as string[],
    },
    // ✅ FIX: answer matches schema (no questionType/variant/items)
    answer: { ...DEFAULT_TF_ANSWER },
    // hint/solution/fullSolution are optional; UI can add them when needed
  }),

  question_mcq: () => ({
    id: randomUUID(),
    type: 'question_mcq' as const,
    prompt: {
      type: 'rich_text' as const,
      format: 'md-math-v1' as const,
      value: 'Choose the correct option:',
      mediaIds: [] as string[],
    },
    answer: {
      multiSelect: DEFAULT_MCQ_ANSWER.multiSelect,
      options: DEFAULT_MCQ_ANSWER.options.map((o) => ({
        id: o.id,
        content: { ...o.content },
      })),
      correctOptionIds: [...DEFAULT_MCQ_ANSWER.correctOptionIds],
    },
  }),

  question_free_response: () => ({
    id: randomUUID(),
    type: 'question_free_response' as const,
    prompt: {
      type: 'rich_text' as const,
      format: 'md-math-v1' as const,
      value: 'Enter your answer:',
      mediaIds: [] as string[],
    },
    answer: { ...DEFAULT_FREE_RESPONSE_ANSWER },
  }),
}
