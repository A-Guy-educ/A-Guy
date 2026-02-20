import type { CollectionConfig } from 'payload'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

import { MediaType } from '@/infra/media/types'
import { isUsersCollectionUser } from '@/server/payload/access/isUsersCollectionUser'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import { tenantField } from '@/server/payload/fields/tenant'
import { anyone } from '../../access/anyone'
import { authenticated } from '../../access/authenticated'
import { createdByField } from '../../fields/createdBy'
import { enforceRetentionPolicyHook } from './hooks/enforceRetentionPolicy'
import { inferMediaTypeHook } from './hooks/inferMediaType'
import { validateMediaUploadHook } from './hooks/validateMediaUpload'

export const Media: CollectionConfig = {
  slug: 'media',
  // folders: true, // Disabled - conflicts with Vercel Blob plugin
  upload: {
    // Vercel Blob storage plugin handles actual file storage
    // Plugin injects disableLocalStorage: true and adapter handlers
    adminThumbnail: 'thumbnail', // Show thumbnail in admin list view
    mimeTypes: [
      'image/*',
      'video/*',
      'audio/*',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/*',
    ],
    // NOTE: imageSizes disabled - causes issues with Vercel Blob plugin
    // The plugin generates sizes as a group field which conflicts with our setup
    // imageSizes: [
    //   { name: 'thumbnail', width: 300, height: 300 },
    //   { name: 'small', width: 600, height: 600 },
    //   { name: 'medium', width: 1024, height: 1024 },
    //   { name: 'large', width: 1920, height: 1920 },
    // ],
  },
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
          Field: '@/ui/admin/MediaPreview#MediaPreview',
        },
      },
    },

    // Created By
    createdByField,

    // Retention Policy (for ephemeral chat media)
    {
      name: 'retentionPolicy',
      type: 'select',
      options: [
        { label: 'Persistent', value: 'persistent' },
        { label: 'Ephemeral', value: 'ephemeral' },
      ],
      defaultValue: 'persistent',
      required: true,
      admin: {
        hidden: true, // Hidden from admin UI
      },
      access: {
        // Access always allows - hook is authoritative for server-only enforcement
        create: () => true,
        update: () => true,
        read: () => true,
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      admin: {
        hidden: true,
        description: 'Auto-set for ephemeral media (30 days from creation)',
      },
      access: {
        // Access always allows - hook is authoritative
        create: () => true,
        update: () => true,
        read: () => true,
      },
    },
    // NOTE: The following fields are now auto-generated by Payload's upload config:
    // - url: The public URL of the uploaded file (proxied through Payload)
    // - filename: The filename stored in blob storage
    // - mimeType: The file's MIME type
    // - filesize: The file size in bytes
    // - width: Image width in pixels (images only)
    // - height: Image height in pixels (images only)
    // - focalX: Focal point X (0-100)
    // - focalY: Focal point Y (0-100)
    // - sizes: Responsive image sizes (thumbnail, small, medium, large)
  ],
  hooks: {
    beforeValidate: [validateMediaUploadHook],
    beforeChange: [enforceRetentionPolicyHook],
  },
  // File storage is handled by @payloadcms/storage-vercel-blob plugin
  // The plugin adds disableLocalStorage: true and adapter handlers to this collection
  // URLs are proxied through Payload (/api/media/file/...) for backward compatibility
  // NOTE: The 'upload' config above is required for Payload to process file uploads
  // and for the Vercel Blob plugin to work correctly
}
