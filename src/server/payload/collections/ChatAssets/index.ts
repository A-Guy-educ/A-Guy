/**
 * ChatAssets Collection
 * Stores chat attachments uploaded directly to Vercel Blob
 */

import type { CollectionConfig } from 'payload'

import { tenantField } from '@/server/payload/fields/tenant'
import { chatAssetsReadAccess } from '../../access/chatAssets'
import { createdByField } from '../../fields/createdBy'

export const ChatAssets: CollectionConfig = {
  slug: 'chat-assets',
  access: {
    create: () => false, // Server-only via overrideAccess
    delete: () => false, // Server-only for cleanup
    read: chatAssetsReadAccess,
    update: () => false, // Server-only
  },
  admin: {
    hidden: ({ user }) => {
      // Visible to admins, hidden for non-admins
      return !user || user.role !== 'admin'
    },
    group: 'System',
    defaultColumns: [
      'originalFilename',
      'mimeType',
      'filesize',
      'createdBy',
      'expiresAt',
      'createdAt',
    ],
    useAsTitle: 'originalFilename',
    description: 'Chat attachments uploaded directly to Vercel Blob',
  },
  fields: [
    // Tenant
    tenantField,

    // Created By
    createdByField,

    // URL (Vercel Blob URL)
    {
      name: 'url',
      type: 'text',
      required: true,
      admin: {
        description: 'Vercel Blob URL for the asset',
      },
    },

    // Pathname (for deletion/prefix enforcement)
    {
      name: 'pathname',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Vercel Blob pathname for the asset',
      },
    },

    // Original Filename
    {
      name: 'originalFilename',
      type: 'text',
      required: true,
      admin: {
        description: 'Original filename as uploaded by user',
      },
    },

    // MIME Type
    {
      name: 'mimeType',
      type: 'text',
      required: true,
      admin: {
        description: 'MIME type of the asset',
      },
    },

    // File Size
    {
      name: 'filesize',
      type: 'number',
      required: true,
      admin: {
        description: 'File size in bytes',
      },
    },

    // Retention Policy
    {
      name: 'retentionPolicy',
      type: 'select',
      options: [
        { label: 'Persistent', value: 'persistent' },
        { label: 'Ephemeral', value: 'ephemeral' },
      ],
      defaultValue: 'ephemeral',
      required: true,
      admin: {
        hidden: true, // Hidden in admin, managed server-side
      },
    },

    // Expires At
    {
      name: 'expiresAt',
      type: 'date',
      admin: {
        hidden: true, // Hidden in admin, managed server-side
      },
    },

    // Upload Session ID (for idempotency/debug)
    {
      name: 'uploadSessionId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        hidden: true,
      },
    },
  ],
}
