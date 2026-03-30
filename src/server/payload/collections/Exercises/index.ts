import type { Access, CollectionConfig } from 'payload'

import type { User } from '@/payload-types'
import { tenantField } from '@/server/payload/fields/tenant'
import { contentLocaleField } from '@/server/payload/fields/contentLocale'
import { anyone } from '../../access/anyone'
import { authenticated } from '../../access/authenticated'
import { createdByField } from '../../fields/createdBy'
import { translatedFromField } from '../../fields/translatedFrom'
import { AccountRole } from '../Users/roles'
import { DEFAULT_CONTENT } from './defaults'
import { ContentSchema } from './schemas'
import { generateSlug, validateSlugUniqueness } from './hooks'
import { addBlockToLesson, removeBlockFromLesson } from '../../hooks/lessons/syncLessonBlocks'

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

  hooks: {
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        if (req.context?._skipBlockSync) return doc

        const newLessonId =
          typeof doc.lesson === 'string' ? doc.lesson : (doc.lesson as { id?: string })?.id
        const oldLessonId = previousDoc
          ? typeof previousDoc.lesson === 'string'
            ? previousDoc.lesson
            : (previousDoc.lesson as { id?: string })?.id
          : null

        // Lesson changed — remove from old, add to new
        if (oldLessonId && oldLessonId !== newLessonId) {
          await removeBlockFromLesson({
            payload: req.payload,
            req,
            lessonId: oldLessonId,
            refId: doc.id,
            blockType: 'exerciseRef',
          })
        }

        if (newLessonId) {
          await addBlockToLesson({
            payload: req.payload,
            req,
            lessonId: newLessonId,
            refId: doc.id,
            blockType: 'exerciseRef',
          })
        }

        return doc
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        if (req.context?._skipBlockSync) return doc

        const lessonId =
          typeof doc.lesson === 'string' ? doc.lesson : (doc.lesson as { id?: string })?.id
        if (lessonId) {
          await removeBlockFromLesson({
            payload: req.payload,
            req,
            lessonId,
            refId: doc.id,
            blockType: 'exerciseRef',
          })
        }

        return doc
      },
    ],
  },

  admin: {
    useAsTitle: 'title',
    defaultColumns: ['order', 'title', 'lesson', 'updatedAt'],
    components: {
      edit: {
        beforeDocumentControls: ['@/ui/admin/TranslationButton#TranslateExerciseAction'],
      },
    },
  },

  fields: [
    // Tenant
    tenantField,
    // Content locale
    contentLocaleField,
    // Translation link
    translatedFromField('exercises'),
    // Section 1: Exercise Meta (Basics)
    {
      type: 'collapsible',
      label: 'Exercise Meta (Basics)',
      admin: { initCollapsed: false },
      fields: [
        {
          name: 'title',
          type: 'text',
          required: false,
          admin: { description: 'Exercise title (for admin reference)' },
        },
        {
          name: 'order',
          type: 'number',
          required: false,
          defaultValue: 0,
          admin: {
            description:
              'DEPRECATED — Order is now defined by lesson blocks array. Kept for backward compatibility.',
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
        {
          name: 'showQuestionNumbering',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              'Show exercise question numbering (the circled number above questions). Enable when multiple exercises share a page.',
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
            // Log full error for server-side debugging
            console.error(
              '[Exercise content validation]',
              JSON.stringify(result.error.issues, null, 2),
            )
            const issues = result.error.issues
              .map((i) => `[${i.path.join('.')}] ${i.message}`)
              .join('; ')
            return `Invalid content: ${issues}`
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
          index: true,
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
        // V2-specific fields for image crop pipeline
        {
          name: 'pipelineVersion',
          type: 'number',
          index: true,
          admin: {
            description: 'Pipeline version (1=text extraction, 2=image crops)',
            hidden: true,
          },
        },
        {
          name: 'sourcePageIndex',
          type: 'number',
          admin: {
            description: 'Zero-based page index in source PDF (V2 image crops)',
            hidden: true,
          },
        },
        {
          name: 'sourceBboxNormalized',
          type: 'json',
          admin: {
            description: 'Normalized bounding box {x,y,width,height} 0..1 (V2 image crops)',
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
