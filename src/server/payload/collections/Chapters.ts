import type { CollectionConfig } from 'payload'

import { tenantField } from '@/server/payload/fields/tenant'
import { adminOnly } from '../access/adminOnly'
import { publishedAndActive } from '../access/publishedAndActive'
import { createdByField } from '../fields/createdBy'
import { formatSlug } from '../fields/formatSlug'
import { computeAdminTitle } from '../hooks/chapters/computeAdminTitle'

export const Chapters: CollectionConfig = {
  slug: 'chapters',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: publishedAndActive,
    update: adminOnly,
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data?.title && !data?.slug) {
          data.slug = formatSlug(data.title)
        }
        return data
      },
      computeAdminTitle,
    ],
  },
  admin: {
    useAsTitle: 'adminTitle',
    defaultColumns: ['course', 'chapterLabel', 'title', 'order', 'status', 'isActive', 'updatedAt'],
  },
  fields: [
    // Tenant
    tenantField,
    {
      name: 'course',
      type: 'relationship',
      relationTo: 'courses',
      required: true,
      index: true,
      admin: {
        description: 'The course this chapter belongs to',
      },
    },
    {
      name: 'chapterLabel',
      type: 'text',
      index: true,
      admin: {
        description: 'Chapter identifier (e.g., "1", "A", "א")',
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Chapter title',
      },
    },
    {
      name: 'adminTitle',
      type: 'text',
      admin: {
        hidden: true,
        description: 'Auto-computed display title for admin (chapter title — course title)',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Detailed description of the chapter',
        components: {
          Field: '@/ui/admin/QuillField#QuillField',
        },
      },
    },
    {
      name: 'mediaFiles',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      admin: {
        description: 'Upload chapter-related media files (images, videos, documents, etc.)',
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
        description: 'Publication status of the chapter',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      admin: {
        description: 'Whether this chapter is currently active',
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
