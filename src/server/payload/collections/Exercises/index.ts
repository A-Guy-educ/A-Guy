import type { Access, CollectionConfig } from 'payload'

import type { User } from '@/payload-types'
import { tenantField } from '@/server/payload/fields/tenant'
import { anyone } from '../../access/anyone'
import { authenticated } from '../../access/authenticated'
import { createdByField } from '../../fields/createdBy'
import { AccountRole } from '../Users/roles'
import { DEFAULT_CONTENT } from './defaults'
import { ContentSchema } from './schemas'
import { generateSlug, normalizeTableCellWhitespace, validateSlugUniqueness } from './hooks'

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

  hooks: {
    beforeValidate: [normalizeTableCellWhitespace],
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
        {
          name: 'slug',
          type: 'text',
          required: false,
          index: true,
          admin: {
            description:
              'URL-friendly identifier (auto-generated from title, unique within lesson)',
          },
          hooks: {
            beforeValidate: [generateSlug, validateSlugUniqueness],
          },
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
            return 'Invalid content. Expected: { blocks: (rich_text | question_select | question_free_response | question_table | latex)[] }.'
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
        // Stage 3: Idempotency fields (shadow fields - not yet enforcing uniqueness)
        {
          name: 'idempotencyKey',
          type: 'text',
          index: true, // Non-unique for now, will be unique in Stage 4
          admin: {
            description: 'Source-based identity key (tenant:lesson:doc:pages:ordinal:version)',
            hidden: true, // Hidden from admin UI - technical field
          },
        },
        {
          name: 'specVersion',
          type: 'text',
          admin: {
            description: 'Extraction spec version for idempotency key stability',
            hidden: true,
          },
        },
        {
          name: 'extractionMeta',
          type: 'json',
          admin: {
            description: 'Additional extraction metadata (segmentIndex, itemOrdinal)',
            hidden: true,
          },
        },
      ],
    },

    // Preview field (sidebar)
    {
      name: 'preview',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '@/ui/admin/ExercisePreview#ExercisePreview',
        },
      },
    },
  ],
}

// Re-export types and utilities for backward compatibility
export { DEFAULT_CONTENT, ExerciseBlockDefaults, generateId } from './defaults'
export type { ContentBlock, ContentSchema, ExerciseContent, LatexBlock } from './schemas'
