import type { CollectionConfig } from 'payload'
import { ValidationError } from 'payload'
import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { ExerciseContentSchema, AnswerSpecSchema } from '../contracts'
import { throwPayloadValidationError } from '../utilities/zodToPayloadError'

/**
 * Exercises Collection - Block V2 (with V1 backward compatibility)
 *
 * Field-level validation + default templates for better Admin UX
 * Supports hierarchical blocks (containers + nested blocks)
 */

// Default template - hierarchical structure with container
const DEFAULT_CONTENT_JSON = {
  contentSchemaVersion: 2,
  stem: [
    {
      id: 'container-1',
      type: 'container',
      title: 'Section 1',
      children: [
        {
          id: 'block-1',
          type: 'rich_text',
          format: 'md-math-v1',
          value: '# Write your question here\n\nExample: Solve for $x$: $2x+3=11$',
        },
      ],
    },
  ],
}

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
    delete: authenticated,
    read: anyone,
    update: authenticated,
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
      admin: {
        initCollapsed: false,
      },
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          admin: {
            description: 'Exercise title (for admin reference)',
          },
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
          admin: {
            description: 'The lesson this exercise belongs to',
          },
        },
        {
          name: 'questionType',
          type: 'select',
          required: true,
          options: [
            {
              label: 'Multiple Choice (MCQ)',
              value: 'mcq',
            },
            {
              label: 'True/False',
              value: 'true_false',
            },
            {
              label: 'Free Response',
              value: 'free_response',
            },
          ],
          admin: {
            description: 'Question type - must match answerSpecJson.questionType',
          },
        },
      ],
    },
    // Section 2: Content
    {
      type: 'collapsible',
      label: 'Content',
      admin: {
        initCollapsed: false,
      },
      fields: [
        {
          name: 'contentJson',
          type: 'json',
          required: true,
          defaultValue: DEFAULT_CONTENT_JSON,
          validate: (value: unknown) => {
            // Try v2 schema first (hierarchical blocks)
            const v2Result = ExerciseContentSchema.safeParse(value)
            if (v2Result.success) {
              return true
            }

            // Fallback to v1 validation for backward compatibility
            if (!value || typeof value !== 'object' || value === null) {
              return 'Invalid content structure'
            }

            const content = value as Record<string, unknown>

            // Check basic structure
            if (content.contentSchemaVersion !== 1 && content.contentSchemaVersion !== 2) {
              return 'Invalid content schema version (must be 1 or 2)'
            }

            if (!Array.isArray(content.stem)) {
              return 'Stem must be an array'
            }

            // For v1: validate flat rich_text blocks
            if (content.contentSchemaVersion === 1) {
              for (let i = 0; i < content.stem.length; i++) {
                const block = content.stem[i]
                if (!block || typeof block !== 'object' || block === null) {
                  return `Block ${i} must be an object`
                }

                const blockObj = block as Record<string, unknown>
                if (blockObj.type !== 'rich_text') {
                  return `Block ${i} must be of type 'rich_text'`
                }
                if (blockObj.format !== 'md-math-v1') {
                  return `Block ${i} must have format 'md-math-v1'`
                }
                // Allow empty value during editing - validation will catch it on submit
                if (typeof blockObj.value !== 'string') {
                  return `Block ${i} value must be a string`
                }
                if (!blockObj.id || typeof blockObj.id !== 'string') {
                  return `Block ${i} must have a valid id`
                }
              }
            }

            return true
          },
          admin: {
            description:
              'Exercise content blocks (stem). Supports hierarchical containers and rich text blocks with Markdown and LaTeX math.',
            components: {
              Field: '@/components/admin/ExerciseContentEditor#ExerciseContentEditor', // Custom V2 Editor
            },
          },
        },
      ],
    },
    // Section 3: Answer
    {
      type: 'collapsible',
      label: 'Answer',
      admin: {
        initCollapsed: false,
      },
      fields: [
        {
          name: 'answerSpecJson',
          type: 'json',
          required: true,
          defaultValue: DEFAULT_ANSWER_MCQ,
          validate: (value, { data }) => {
            // Validate structure with Zod
            const result = AnswerSpecSchema.safeParse(value)
            if (!result.success) {
              throwPayloadValidationError(result.error, 'answerSpecJson')
            }

            // Check questionType consistency
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
  ],
}
