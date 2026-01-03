import type { CollectionConfig } from 'payload'
import { ValidationError } from 'payload'
import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { AnswerSpecSchema } from '../contracts'
import { throwPayloadValidationError } from '../utilities/zodToPayloadError'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { createdByField } from '../fields/createdBy'

import type { Access } from 'payload'

const isAdminOrOwner: Access = ({ req }) => {
  const user = req.user
  if (!user) return false

  // אדמין
  if (user.role === 'admin') return true

  // בעלים
  return {
    owner: {
      equals: user.id,
    },
  }
}

/**
 * Exercises Collection — Content (strict, no backward compatibility)
 *
 * Target structure:
 *   exercise.content = { blocks: RichTextBlock[] }
 *
 * Each RichTextBlock can reference media via:
 *   mediaIds: string[]
 */

// ---- Strict content schema (flat only) ----
const RichTextBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('rich_text'),
    format: z.literal('md-math-v1'),
    value: z.string(),
    mediaIds: z.array(z.string().min(1)).default([]), // ✅ per-block media references
  })
  .strict()

const ContentSchema = z
  .object({
    blocks: z.array(RichTextBlockSchema),
  })
  .strict()

// Default content (function => unique IDs per new doc)
const DEFAULT_CONTENT = () => ({
  blocks: [
    {
      id: randomUUID(),
      type: 'rich_text',
      format: 'md-math-v1',
      value: '# Write your question here\n\nExample: Solve for $x$: $2x+3=11$',
      mediaIds: [],
    },
  ],
})

const DEFAULT_ANSWER_MCQ = {
  questionType: 'mcq',
  multiSelect: false,
  options: [
    {
      id: 'o1',
      content: [{ id: 't1', type: 'rich_text', format: 'md-math-v1', value: 'Option A' }],
    },
    {
      id: 'o2',
      content: [{ id: 't2', type: 'rich_text', format: 'md-math-v1', value: 'Option B' }],
    },
  ],
  correctOptionIds: ['o1'],
}

const DEFAULT_ANSWER_TRUE_FALSE = {
  questionType: 'true_false',
  correct: true,
}

const DEFAULT_ANSWER_FREE_RESPONSE = {
  questionType: 'free_response',
  responseKind: 'numeric',
  acceptedAnswers: ['4'],
  tolerance: 0,
}

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
    defaultColumns: ['order', 'title', 'lesson', 'questionType', 'updatedAt'],
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
        {
          name: 'questionType',
          type: 'select',
          required: true,
          options: [
            { label: 'Multiple Choice (MCQ)', value: 'mcq' },
            { label: 'True/False', value: 'true_false' },
            { label: 'Free Response', value: 'free_response' },
          ],
          admin: { description: 'Question type - must match answerSpecJson.questionType' },
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
            return 'Invalid content. Expected: { blocks: RichTextBlock[] } with optional mediaIds: string[].'
          },
          admin: {
            description:
              'Exercise content. Format: { blocks: [...] } (each block supports mediaIds: string[])',
            components: {
              Field: '@/components/admin/ExerciseContentEditor#ExerciseContentEditor',
            },
          },
        },
      ],
    },

    // Section 3: Answer
    {
      type: 'collapsible',
      label: 'Answer',
      admin: { initCollapsed: false },
      fields: [
        {
          name: 'answerSpecJson',
          type: 'json',
          required: true,
          defaultValue: DEFAULT_ANSWER_MCQ,
          validate: (value, { data }) => {
            const result = AnswerSpecSchema.safeParse(value)
            if (!result.success) {
              throwPayloadValidationError(result.error, 'answerSpecJson')
            }

            const questionType = (data as any)?.questionType
            if (questionType && result.data.questionType !== questionType) {
              throw new ValidationError({
                errors: [
                  {
                    path: 'answerSpecJson.questionType',
                    message: `Question type mismatch: this field has questionType="${result.data.questionType}" but the Question Type field is set to "${questionType}". These must match.`,
                  },
                ],
              })
            }

            return true
          },
          admin: {
            description: 'Answer specification - must match the selected Question Type above',
            components: {
              Field: '@/components/admin/AnswerSpecJsonField#AnswerSpecJsonField',
            },
          },
        },
      ],
    },

    // Created By
    createdByField,
  ],
}
