import type { Access, CollectionConfig } from 'payload'

import type { User } from '@/payload-types'
import { tenantField } from '@/server/payload/fields/tenant'
import { anyone } from '../../access/anyone'
import { authenticated } from '../../access/authenticated'
import { createdByField } from '../../fields/createdBy'
import { AccountRole } from '../Users/roles'
import { DEFAULT_CONTENT } from './defaults'
import { ContentSchema } from './schemas'

/**
 * Access control - Exercise-specific
 * Admin or owner can update/delete
 */
const isAdminOrOwner: Access = ({ req }) => {
  const user = req.user as User | null
  if (!user) return false

  // Admin
  if (user.role === AccountRole.Admin) return true

  // Owner
  return {
    owner: {
      equals: user.id,
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
 * - NO exercise-level answer
 * - Each question block owns:
 *   - prompt (required)
 *   - answer (required)        <-- ONLY grading data
 *   - hint/solution/fullSolution (optional)  <-- teacher/explanation data
 */
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
    // Tenant
    tenantField,
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
            return 'Invalid content. Expected: { blocks: (rich_text | question_select | question_mcq | question_free_response)[] }.'
          },
          admin: {
            description:
              'Ordered blocks stream. Use question_* blocks to add questions, and rich_text blocks for instructions/notes between questions.',
            components: {
              Field: '@/ui/admin/ExerciseContentEditor#ExerciseContentEditor',
            },
          },
        },
      ],
    },

    // Created By
    createdByField,

    // ADD: Conversion Metadata Section
    {
      type: 'collapsible',
      label: 'Conversion Metadata',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'origin',
          type: 'select',
          options: [
            { label: 'Manual', value: 'manual' },
            { label: 'Conversion', value: 'conversion' },
            { label: 'Import', value: 'import' },
          ],
          defaultValue: 'manual',
          required: true,
          index: true,
          hooks: {
            beforeValidate: [
              async ({ value, operation }) => {
                // Backfill: set default for existing exercises without origin
                if (operation === 'update' && !value) {
                  return 'manual'
                }
                return value || 'manual'
              },
            ],
          },
        },
        {
          name: 'sourceDoc',
          type: 'relationship',
          relationTo: 'media',
          admin: { description: 'Original PDF media for conversion exercises' },
        },
        {
          name: 'conversionJobId',
          type: 'text',
          admin: { description: 'Payload job ID that created this exercise' },
        },
        {
          name: 'sourcePageStart',
          type: 'number',
          admin: { description: 'Starting page in source PDF' },
        },
        {
          name: 'sourcePageEnd',
          type: 'number',
          admin: { description: 'Ending page in source PDF' },
        },
        {
          name: 'sourceOrderInSegment',
          type: 'number',
          admin: { description: 'Order within the segment (1-indexed)' },
        },
        {
          name: 'contentHash',
          type: 'text',
          admin: { description: 'SHA256 hash for deduplication' },
        },
      ],
    },
  ],
}

// Re-export types and utilities for backward compatibility
export { ExerciseBlockDefaults } from './defaults'
export {
  ContentBlockSchema,
  ContentSchema,
  QuestionFreeResponseBlockSchema,
  LatexBlockSchema,
  type ContentBlock,
  type LatexBlock,
} from './schemas'
