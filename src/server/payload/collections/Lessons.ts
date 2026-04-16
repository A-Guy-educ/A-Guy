import type { CollectionConfig } from 'payload'

import { DEFAULT_LESSON_ACCESS_TYPE } from '@/server/constants/access-types'
import { tenantField } from '@/server/payload/fields/tenant'
import { contentLocaleField } from '@/server/payload/fields/contentLocale'
import { adminOnly } from '../access/adminOnly'
import { publishedAndActive } from '../access/publishedAndActive'
import { contentStatusFields } from '../fields/contentStatus'
import { createdByField } from '../fields/createdBy'
import { formatSlugAsync } from '../fields/formatSlug'
import { translatedFromField } from '../fields/translatedFrom'

export const Lessons: CollectionConfig = {
  slug: 'lessons',
  defaultSort: 'order',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: publishedAndActive,
    update: adminOnly,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        if (!data) return data

        const title = data.title
        const titleChanged = operation === 'update' && title && title !== originalDoc?.title

        // When title changes → always regenerate slug from the new title
        // When no slug → generate from title
        // Otherwise → keep slug as-is (including " - Copy" from duplication)
        if (titleChanged || (!data.slug && title)) {
          data.slug = await formatSlugAsync(title)
        } else if (data.slug) {
          data.slug = data.slug.trim()
        }

        // On create, always ensure uniqueness (handles duplication & conflicts)
        // On update, ensure uniqueness only if slug changed
        const slugChanged = operation === 'update' && data.slug !== originalDoc?.slug
        if (data.slug && (operation === 'create' || slugChanged)) {
          const baseSlug = data.slug
          let slug = baseSlug
          let counter = 1
          const MAX_ATTEMPTS = 100

          for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            const existing = await req.payload.find({
              collection: 'lessons',
              where: { slug: { equals: slug } },
              limit: 1,
              depth: 0,
              req,
            })

            if (existing.docs.length === 0) {
              data.slug = slug
              return data
            }

            slug = `${baseSlug}-${counter}`
            counter++
          }

          // Fallback: append timestamp if all numeric suffixes taken
          data.slug = `${baseSlug}-${Date.now().toString(36)}`
        }

        return data
      },
      // Auto-populate course from chapter -> course
      async ({ data, req }) => {
        if (data?.chapter) {
          try {
            const chapterId = typeof data.chapter === 'string' ? data.chapter : data.chapter?.id
            if (chapterId) {
              const chapter = await req.payload.findByID({
                collection: 'chapters',
                id: chapterId,
                depth: 0,
                select: { course: true },
              })
              if (chapter?.course) {
                data.course =
                  typeof chapter.course === 'string' ? chapter.course : chapter.course?.id
              }
            }
          } catch {
            // Silently skip — course is a convenience field
          }
        }
        return data
      },
    ],
    afterRead: [
      // Lazy backfill: when a lesson is read and its denormalized course field is
      // empty, resolve it from chapter -> course and persist to the DB.
      // One-time write per record — subsequent reads skip (already populated).
      // Skipped during build/seed (no req.user) to avoid slow static generation.
      async ({ doc, req }) => {
        if (!doc?.chapter) return doc
        if (doc.course) return doc
        if (!req.user) return doc

        try {
          const chapterId = typeof doc.chapter === 'string' ? doc.chapter : doc.chapter?.id
          if (!chapterId) return doc

          const chapter = await req.payload.findByID({
            collection: 'chapters',
            id: chapterId,
            depth: 0,
            select: { course: true },
          })
          const courseId =
            typeof chapter?.course === 'string' ? chapter.course : chapter?.course?.id

          if (courseId) {
            // Persist to DB so list-view filters match on the next query
            await req.payload.update({
              collection: 'lessons',
              id: doc.id,
              data: { course: courseId } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
              overrideAccess: true,
            })
            doc.course = courseId
          }
        } catch {
          // Silently skip — backfill is best-effort
        }

        return doc
      },
    ],
  },
  admin: {
    useAsTitle: 'title',
    listSearchableFields: ['chapter.course.courseLabel', 'chapter.course.title'],
    components: {
      edit: {
        beforeDocumentControls: [
          '@/ui/admin/TranslationButton#TranslateLessonAction',
          '@/ui/admin/CascadeDeleteButton#LessonCascadeDelete',
        ],
      },
    },
    defaultColumns: [
      'chapter',
      'title',
      'locale',
      'type',
      'slug',
      'order',
      'status',
      'isActive',
      'contentStatus',
      'updatedAt',
    ],
  },
  fields: [
    // Tenant
    tenantField,
    // Content locale
    contentLocaleField,
    // Translation link
    translatedFromField('lessons'),
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
      name: 'course',
      type: 'relationship',
      relationTo: 'courses',
      index: true,
      admin: {
        hidden: true,
        description: 'Auto-populated from chapter. Used for filtering lessons by course.',
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
      index: true,
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
        { label: 'Paid (Requires Entitlement)', value: 'paid' },
      ],
      admin: {
        position: 'sidebar',
        description:
          'Access control for this lesson. "Inherit" uses the parent course setting. "Gated" is a client-side nudge, not hard enforcement.',
      },
    },
    // --- Lesson Blocks (ordered playlist) ---
    {
      name: 'blocks',
      type: 'textarea',
      admin: {
        description: 'Ordered playlist of exercises and content pages. Defines the lesson flow.',
        components: {
          Field: '@/ui/admin/LessonBlocksField#LessonBlocksField',
        },
      },
    },
    // Context Exercise Viewer (displays parsed exercises from ContextExtractions)
    {
      name: 'contextExerciseViewer',
      type: 'ui',
      admin: {
        components: {
          Field: '@/ui/admin/context-exercise-viewer#ContextExerciseViewer',
        },
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

    // Content Status
    ...contentStatusFields,

    // Formula Sheet (optional)
    {
      name: 'formulaSheet',
      type: 'relationship',
      relationTo: 'formula-sheets',
      maxDepth: 0,
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Lesson-specific formula sheet (overrides course default)',
      },
    },

    // Content hierarchy navigation (sidebar)
    {
      name: 'contentNavigation',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '@/ui/admin/ContentNavigation#LessonNavigation',
        },
      },
    },

    // Created By
    createdByField,
  ],
}
