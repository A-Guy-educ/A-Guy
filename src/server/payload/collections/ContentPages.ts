import type { CollectionConfig } from 'payload'

import { tenantField } from '@/server/payload/fields/tenant'
import { Content } from '../blocks/Content/config'
import { GeometryBlock } from '../blocks/GeometryBlock/config'
import { GraphBlock } from '../blocks/GraphBlock/config'
import { HtmlBlock } from '../blocks/HtmlBlock/config'
import { MediaBlock } from '../blocks/MediaBlock/config'
import { TableBlock } from '../blocks/TableBlock/config'
import { adminOnly } from '../access/adminOnly'
import { publishedAndActive } from '../access/publishedAndActive'
import { createdByField } from '../fields/createdBy'
import { formatSlug } from '../fields/formatSlug'

export const ContentPages: CollectionConfig = {
  slug: 'content-pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'status', 'isActive', 'updatedAt'],
  },
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
  fields: [
    tenantField,
    {
      name: 'title',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Content page title',
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
    {
      name: 'body',
      type: 'blocks',
      blocks: [Content, HtmlBlock, MediaBlock, TableBlock, GeometryBlock, GraphBlock],
      required: true,
      admin: {
        description:
          'Page content. Supports rich text, HTML/SVG, media, tables, geometry, and graphs.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      index: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: {
        description: 'Publication status',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      admin: {
        description: 'Whether this content page is currently active',
      },
    },
    createdByField,
  ],
}
