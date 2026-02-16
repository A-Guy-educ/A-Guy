import type { CollectionConfig } from 'payload'

import { tenantField } from '@/server/payload/fields/tenant'
import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { createdByField } from '../fields/createdBy'
import { LessonScriptSchema } from './Lessons/interactive-demo-schema'

const formatSlug = (val: string): string =>
  val
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '')
    .toLowerCase()

export const Lessons: CollectionConfig = {
  slug: 'lessons',
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  hooks: {
    beforeValidate: [
      async ({ data, operation: _operation, req: _req }) => {
        // Hook A: Schema validation for interactive_demo lessons
        if (data?.type === 'interactive_demo' && data?.lessonScript) {
          const result = LessonScriptSchema.safeParse(data.lessonScript)
          if (!result.success) {
            const errorMessages = result.error.issues.map((issue) => issue.message).join(', ')
            throw new Error(`Invalid lessonScript: ${errorMessages}`)
          }
        }
        return data
      },
    ],
    beforeChange: [
      ({ data }) => {
        if (data?.title && !data?.slug) {
          // Generate unique slug from title
          // Include timestamp for uniqueness, falling back to random if timestamp not available
          const timestamp =
            typeof data.createdAt === 'string'
              ? data.createdAt.replace(/[^0-9]/g, '').slice(-6)
              : Date.now().toString().slice(-6)
          data.slug = `${formatSlug(data.title)}-${timestamp}`
        }
        return data
      },
      async ({ data, operation, originalDoc, req }) => {
        // Hook B: Active session guard (FIX #4)
        // Only applies to update operation for interactive_demo lessons
        if (operation !== 'update' || data?.type !== 'interactive_demo') return data
        if (!originalDoc?.lessonScript || !data?.lessonScript) return data

        const scriptChanged =
          JSON.stringify(data.lessonScript) !== JSON.stringify(originalDoc.lessonScript)
        if (!scriptChanged) return data

        const activeSessions = await req.payload.find({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          collection: 'lesson-sessions' as any,
          where: {
            lesson: { equals: originalDoc.id },
            status: { equals: 'active' },
          },
          limit: 1,
          overrideAccess: true,
        })

        if (activeSessions.docs.length > 0) {
          throw new Error(
            'Cannot modify lessonScript while active sessions exist. ' +
              'Complete or reset all active sessions first.',
          )
        }

        return data
      },
    ],
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: [
      'chapter',
      'title',
      'type',
      'slug',
      'order',
      'status',
      'isActive',
      'updatedAt',
    ],
  },
  fields: [
    // Tenant
    tenantField,
    {
      name: 'chapter',
      type: 'relationship',
      relationTo: 'chapters',
      required: true,
      index: true,
      admin: {
        description: 'The chapter this lesson belongs to',
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'learning',
      index: true,
      options: [
        {
          label: 'Learning',
          value: 'learning',
        },
        {
          label: 'Practice',
          value: 'practice',
        },
        {
          label: 'Exam',
          value: 'exam',
        },
        {
          label: 'Interactive Demo',
          value: 'interactive_demo',
        },
      ],
      admin: {
        description: 'The type of lesson: Learning content, Practice exercises, or Exam',
        position: 'sidebar',
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Lesson title',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Detailed description of the lesson',
      },
    },
    {
      name: 'order',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Sort order within the course',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        {
          label: 'Draft',
          value: 'draft',
        },
        {
          label: 'Published',
          value: 'published',
        },
        {
          label: 'Archived',
          value: 'archived',
        },
      ],
      admin: {
        description: 'Publication status of the lesson',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      admin: {
        description: 'Whether this lesson is currently active',
      },
    },
    // --- Intro Page (pre-lesson context screen) ---
    {
      name: 'introEnabled',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Show an intro/about page before the lesson starts',
        position: 'sidebar',
      },
    },
    {
      name: 'introDescription',
      type: 'textarea',
      admin: {
        description: 'HTML content for the intro page. Supports raw HTML (bold, lists, etc).',
        condition: (data) => Boolean(data?.introEnabled),
      },
    },
    {
      name: 'introMedia',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Image, SVG, or video displayed on the intro page',
        condition: (data) => Boolean(data?.introEnabled),
      },
    },
    // --- Lesson Content ---
    {
      name: 'contentFiles',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      admin: {
        description: 'Upload lesson content files (PDFs, videos, images, etc.)',
      },
    },
    // Exercise Conversion Panel (shows for each PDF - admin only)
    {
      name: 'conversionPanel',
      type: 'ui',
      admin: {
        components: {
          Field: '@/ui/admin/exercise-conversion/LessonConversionPanel#LessonConversionPanel',
        },
      },
    },
    {
      name: 'lessonContextText',
      type: 'textarea',
      maxLength: 100_000, // Match LESSON_CONTEXT_MAX_CHARS in src/lib/ai/lesson-context.ts
      admin: {
        description:
          'AI context text for this lesson. Injected into chat prompts at runtime. NOT indexed or searchable.',
      },
      // NOT indexed, NOT required
    },
    {
      name: 'prompt',
      type: 'relationship',
      relationTo: 'prompts',
      index: true,
      admin: {
        position: 'sidebar',
        description: 'AI system prompt for this lesson (uses default if not set)',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: false,
      index: true,
      unique: true,
      admin: {
        position: 'sidebar',
        description: 'URL-friendly identifier (auto-generated from title if empty)',
      },
    },

    // --- Interactive Demo Fields ---
    {
      name: 'lessonScript',
      type: 'json',
      admin: {
        description: 'JSON lesson script for interactive_demo lessons (blocks array)',
        condition: (data) => data?.type === 'interactive_demo',
      },
    },
    {
      name: 'remediationEnabled',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Enable AI remediation for incorrect answers',
        condition: (data) => data?.type === 'interactive_demo',
        position: 'sidebar',
      },
    },
    {
      name: 'typewriterEnabled',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Enable typewriter reveal animation',
        condition: (data) => data?.type === 'interactive_demo',
        position: 'sidebar',
      },
    },
    {
      name: 'adaptivityEnabled',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Enable basic skill score adaptivity',
        condition: (data) => data?.type === 'interactive_demo',
        position: 'sidebar',
      },
    },

    // Created By
    createdByField,
  ],
}
