import type { CollectionConfig } from 'payload'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'

import { anyone } from '../../access/anyone'
import { authenticated } from '../../access/authenticated'
import { createdByField } from '../../fields/createdBy'
import { AccountRole } from '@/collections/Users/roles'
import { inferMediaTypeHook } from './hooks/inferMediaType'
import { validateMediaUploadHook } from './hooks/validateMediaUpload'
import { MediaType } from '@/lib/media/types'
import { tenantField } from '@/fields/tenant'
import { isUsersCollectionUser } from '@/access/isUsersCollectionUser'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const Media: CollectionConfig = {
  slug: 'media',
  folders: true,
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  fields: [
    // Tenant
    tenantField,
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Image', value: MediaType.Image },
        { label: 'Video', value: MediaType.Video },
        { label: 'Audio', value: MediaType.Audio },
        { label: 'PDF', value: MediaType.PDF },
        { label: 'SVG', value: MediaType.SVG },
        { label: 'Document', value: MediaType.Document },
        { label: 'External', value: MediaType.External },
        { label: 'Other', value: MediaType.Other },
      ],
      admin: {
        position: 'sidebar',
        description: 'Auto-detected from file type (admin can override)',
      },
      access: {
        update: ({ req: { user } }) => {
          // Only admins can update (others are read-only)
          return isUsersCollectionUser(user) && user.role === AccountRole.Admin
        },
      },
      hooks: {
        beforeChange: [inferMediaTypeHook],
      },
      required: true,
      defaultValue: MediaType.Other,
    },
    {
      name: 'externalUrl',
      type: 'text',
      admin: {
        condition: (data) => data?.type === MediaType.External,
        description: 'URL for external embed or link',
      },
      required: false,
    },
    {
      name: 'alt',
      type: 'text',
      admin: {
        condition: (data) => ['image', 'svg'].includes(data?.type),
        description: 'Alternative text for images and SVGs (required for accessibility)',
      },
    },
    {
      name: 'caption',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [...rootFeatures, FixedToolbarFeature(), InlineToolbarFeature()]
        },
      }),
    },
    {
      name: 'preview',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '@/components/admin/MediaPreview#MediaPreview',
        },
      },
    },

    // Created By
    createdByField,
  ],
  hooks: {
    beforeValidate: [validateMediaUploadHook],
  },
  upload: {
    // Upload to the public/media directory in Next.js making them publicly accessible even outside of Payload
    staticDir: path.resolve(dirname, '../../../public/media'),
    adminThumbnail: 'thumbnail',
    focalPoint: true,
    imageSizes: [
      {
        name: 'thumbnail',
        width: 300,
      },
      {
        name: 'square',
        width: 500,
        height: 500,
      },
      {
        name: 'small',
        width: 600,
      },
      {
        name: 'medium',
        width: 900,
      },
      {
        name: 'large',
        width: 1400,
      },
      {
        name: 'xlarge',
        width: 1920,
      },
      {
        name: 'og',
        width: 1200,
        height: 630,
        crop: 'center',
      },
    ],
  },
}
