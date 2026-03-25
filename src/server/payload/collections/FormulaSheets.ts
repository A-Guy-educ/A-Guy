/**
 * FormulaSheets Collection
 *
 * @fileType collection-config
 * @domain formula-sheets
 * @pattern published-content, reusable-content
 * @ai-summary Reusable formula sheet collection for math reference content
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/server/payload/access/adminOnly'
import { authenticatedOrPublished } from '@/server/payload/access/authenticatedOrPublished'
import { Content } from '@/server/payload/blocks/Content/config'
import { HtmlBlock } from '@/server/payload/blocks/HtmlBlock/config'
import { MediaBlock } from '@/server/payload/blocks/MediaBlock/config'
import { TableBlock } from '@/server/payload/blocks/TableBlock/config'
import { contentLocaleField } from '@/server/payload/fields/contentLocale'
import { createdByField } from '@/server/payload/fields/createdBy'
import { tenantField } from '@/server/payload/fields/tenant'

export const FormulaSheets: CollectionConfig = {
  slug: 'formula-sheets',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: authenticatedOrPublished,
    update: adminOnly,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'locale', 'contentType', 'status', 'updatedAt'],
    description: 'Manage reusable formula sheet content for math reference',
  },
  fields: [
    // Tenant
    tenantField,
    // Content locale
    contentLocaleField,
    // Title
    {
      name: 'title',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Display title for the formula sheet',
      },
    },
    // Content type selector
    {
      name: 'contentType',
      type: 'select',
      required: true,
      defaultValue: 'blocks',
      options: [
        { label: 'Blocks (Rich content)', value: 'blocks' },
        { label: 'Rich Text with LaTeX', value: 'richText' },
        { label: 'PDF File', value: 'pdf' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Choose how to display the formula content',
      },
    },
    // PDF upload (only when contentType is 'pdf')
    {
      name: 'pdfFile',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Upload a PDF file containing formulas',
        condition: (_, siblingData) => siblingData?.contentType === 'pdf',
      },
      hooks: {
        beforeValidate: [
          ({ siblingData, value }) => {
            // Only validate if contentType is pdf
            if (siblingData?.contentType !== 'pdf') return undefined
            return value
          },
        ],
      },
    },
    // Rich text content (only when contentType is 'richText')
    {
      name: 'richTextContent',
      type: 'richText',
      admin: {
        description: 'Rich text content with LaTeX support for mathematical formulas',
        condition: (_, siblingData) => siblingData?.contentType === 'richText',
      },
    },
    // Blocks content (only when contentType is 'blocks')
    {
      name: 'bodyBlocks',
      type: 'blocks',
      blocks: [Content, HtmlBlock, MediaBlock, TableBlock],
      admin: {
        description: 'Build formula sheet using content blocks with LaTeX support',
        initCollapsed: false,
        condition: (_, siblingData) => siblingData?.contentType === 'blocks',
      },
    },
    // Status
    {
      name: 'status',
      type: 'select',
      required: true,
      index: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Publication status',
      },
    },
    // Published at (for sorting)
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        hidden: true,
      },
    },
    // Created By
    createdByField,
  ],
  timestamps: true,
}
