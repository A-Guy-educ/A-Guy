import type { CollectionConfig } from 'payload'

import { validateHtmlContent } from '@/server/payload/fields/htmlValidation'
import { tenantField } from '@/server/payload/fields/tenant'
import { adminOnly } from '../../access/adminOnly'
import { anyone } from '../../access/anyone'
import { createdByField } from '../../fields/createdBy'
import { generateContentPageSlug } from './hooks'

export const ContentPages: CollectionConfig = {
  slug: 'content-pages',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: anyone,
    update: adminOnly,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'status', 'isActive', 'updatedAt'],
    group: 'Content',
  },
  fields: [
    tenantField,
    {
      name: 'title',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'Content page title' },
    },
    {
      name: 'slug',
      type: 'text',
      required: false,
      index: true,
      unique: true,
      admin: {
        position: 'sidebar',
        description: 'URL-friendly identifier (auto-generated from title)',
      },
      hooks: {
        beforeValidate: [generateContentPageSlug],
      },
    },
    {
      name: 'htmlContent',
      type: 'textarea',
      required: true,
      validate: validateHtmlContent,
      admin: {
        description: 'HTML content for this page. Use the editor for rich formatting.',
        components: {
          Field: '@/ui/admin/QuillField#QuillField',
        },
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      admin: {
        description: 'Publication status',
        position: 'sidebar',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      admin: {
        description: 'Whether this content page is currently active',
        position: 'sidebar',
      },
    },
    createdByField,
  ],
}
