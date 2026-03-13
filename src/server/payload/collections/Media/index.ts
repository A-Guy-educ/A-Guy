import type { CollectionConfig } from 'payload'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

import { extractYouTubeVideoId, isYouTubeUrl } from '@/infra/media/youtube'
import { MediaType } from '@/infra/media/types'
import { isUsersCollectionUser } from '@/server/payload/access/isUsersCollectionUser'
import { AccountRole } from '@/server/payload/collections/Users/roles'
import { tenantField } from '@/server/payload/fields/tenant'
import { anyone } from '../../access/anyone'
import { adminOnly } from '../../access/adminOnly'
import { createdByField } from '../../fields/createdBy'
import { enforceRetentionPolicyHook } from './hooks/enforceRetentionPolicy'
import { inferMediaTypeHook } from './hooks/inferMediaType'
import { resolveEmbedHook } from './hooks/resolveEmbed'
import { validateMediaUploadHook } from './hooks/validateMediaUpload'

export const Media: CollectionConfig = {
  slug: 'media',
  // folders: true, // Disabled - conflicts with Vercel Blob plugin
  upload: {
    // Allow External media type to be saved without a file upload.
    // Our validateMediaUploadHook enforces file presence for non-External types.
    filesRequiredOnCreate: false,
    // Vercel Blob storage plugin handles actual file storage
    // Plugin injects disableLocalStorage: true and adapter handlers
    // Show thumbnail in admin list view - uses function to handle External media
    adminThumbnail: ({ doc }) => {
      // Cast doc to access typed properties
      const docData = doc as {
        type?: string
        externalUrl?: string
        url?: string
        embedThumbnailUrl?: string | null
      }
      if (docData.type === MediaType.External) {
        // YouTube: use YouTube's CDN thumbnail directly (no API needed)
        if (docData.externalUrl && isYouTubeUrl(docData.externalUrl)) {
          const videoId = extractYouTubeVideoId(docData.externalUrl)
          if (videoId) {
            return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
          }
        }
        // Vimeo (and other providers): use the thumbnail fetched by resolveEmbedHook
        if (docData.embedThumbnailUrl) {
          return docData.embedThumbnailUrl
        }
        return null
      }
      // Uploaded files: return the main URL (false to disable if url is undefined)
      return docData.url || false
    },
    // Skip Payload's buffer-based checkFileRestrictions.
    // With clientUploads=true, Payload re-fetches the entire file from Vercel Blob into
    // server memory before running restrictions — causing OOM/timeouts for large video files.
    // Our validateMediaUploadHook already handles MIME type and size validation server-side.
    allowRestrictedFileTypes: true,
    mimeTypes: [
      'image/*',
      // Explicit video MIME types + extensions for browser file-picker compatibility.
      // macOS Safari requires 'video/quicktime' or '.mov' explicitly — 'video/*' alone
      // does not show .mov files in the file picker on all browsers.
      'video/*',
      'video/mp4',
      'video/quicktime',
      '.mp4',
      '.mov',
      'audio/*',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/*',
      'application/x-tex',
      'application/x-latex',
      'application/octet-stream',
      '.tex',
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
    create: adminOnly,
    delete: adminOnly,
    read: anyone,
    update: adminOnly,
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
      name: 'embedProvider',
      type: 'select',
      options: [
        { label: 'YouTube', value: 'youtube' },
        { label: 'Vimeo', value: 'vimeo' },
        { label: 'Generic', value: 'generic' },
      ],
      admin: {
        condition: (data) => data?.type === MediaType.External,
        position: 'sidebar',
        description: 'Auto-detected from URL. Do not change manually.',
        readOnly: true,
      },
      required: false,
    },
    {
      name: 'embedVideoId',
      type: 'text',
      admin: {
        condition: (data) => data?.type === MediaType.External,
        position: 'sidebar',
        description: 'Provider-specific video/content ID',
        readOnly: true,
      },
      required: false,
    },
    {
      name: 'embedUrl',
      type: 'text',
      admin: {
        condition: (data) => data?.type === MediaType.External,
        position: 'sidebar',
        description: 'Embed-ready URL for iframe (auto-generated)',
        readOnly: true,
      },
      required: false,
    },
    {
      name: 'embedTitle',
      type: 'text',
      admin: {
        condition: (data) => data?.type === MediaType.External,
        description: 'Title fetched from provider (auto-populated)',
        readOnly: true,
      },
      required: false,
    },
    {
      name: 'embedThumbnailUrl',
      type: 'text',
      admin: {
        condition: (data) => data?.type === MediaType.External,
        description: 'Thumbnail URL fetched from provider (auto-populated)',
        readOnly: true,
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
    beforeChange: [resolveEmbedHook, enforceRetentionPolicyHook],
  },
  // File storage is handled by @payloadcms/storage-vercel-blob plugin
  // The plugin adds disableLocalStorage: true and adapter handlers to this collection
  // URLs are proxied through Payload (/api/media/file/...) for backward compatibility
  // NOTE: The 'upload' config above is required for Payload to process file uploads
  // and for the Vercel Blob plugin to work correctly
}
