import type { CollectionConfig } from 'payload'

import { DEFAULT_LESSON_ACCESS_TYPE } from '@/server/constants/access-types'
import { tenantField } from '@/server/payload/fields/tenant'
import { adminOnly } from '../access/adminOnly'
import { publishedAndActive } from '../access/publishedAndActive'
import { createdByField } from '../fields/createdBy'
import { formatSlug } from '../fields/formatSlug'

export const Lessons: CollectionConfig = {
  slug: 'lessons',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: publishedAndActive,
    update: adminOnly,
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data?.slug) {
          data.slug = data.slug.trim()
        }
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
        components: {
          Field: '@/ui/admin/QuillField#QuillField',
        },
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
      index: true,
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
    {
      name: 'accessType',
      type: 'select',
      required: true,
      defaultValue: DEFAULT_LESSON_ACCESS_TYPE,
      options: [
        { label: 'Inherit from Course', value: 'inherit' },
        { label: 'Free Access', value: 'free' },
        { label: 'Require Registration', value: 'mandatory' },
        {
          label: 'Gated (5-Minute Delay)',
          value: 'gated',
        },
      ],
      admin: {
        position: 'sidebar',
        description:
          'Access control for this lesson. "Inherit" uses the parent course setting. "Gated" is a client-side nudge, not hard enforcement.',
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
        components: {
          Field: '@/ui/admin/QuillField#QuillField',
        },
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

    // Created By
    createdByField,
  ],
}
