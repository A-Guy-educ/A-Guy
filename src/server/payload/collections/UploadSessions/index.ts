/**
 * UploadSessions Collection
 * Tracks upload sessions for chat assets (direct-to-Blob uploads)
 */

import type { CollectionConfig } from 'payload'

import { tenantField } from '@/server/payload/fields/tenant'
import { adminOnly } from '../../access/adminOnly'
import { createdByField } from '../../fields/createdBy'

export const UploadSessions: CollectionConfig = {
  slug: 'upload-sessions',
  access: {
    create: () => false,
    delete: () => false,
    read: adminOnly,
    update: () => false,
  },
  admin: {
    hidden: ({ user }) => {
      return !user || user.role !== 'admin'
    },
    group: 'System',
    defaultColumns: [
      'purpose',
      'originalFilename',
      'status',
      'createdBy',
      'expiresAt',
      'createdAt',
    ],
    useAsTitle: 'purpose',
    description: 'Upload session tracking for direct-to-Blob uploads',
  },
  fields: [
    tenantField,
    createdByField,
    {
      name: 'purpose',
      type: 'select',
      options: [{ label: 'Chat Media', value: 'chat-media' }],
      defaultValue: 'chat-media',
      required: true,
      admin: { description: 'Purpose of the upload session' },
    },
    {
      name: 'originalFilename',
      type: 'text',
      required: true,
      admin: { description: 'Original filename as uploaded by user' },
    },
    {
      name: 'mimeType',
      type: 'text',
      required: true,
      admin: { description: 'MIME type of the file' },
    },
    {
      name: 'expectedSize',
      type: 'number',
      admin: { description: 'Expected file size in bytes (from client hint)' },
    },
    {
      name: 'pathname',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'Vercel Blob pathname for the file' },
    },
    {
      name: 'blobUrl',
      type: 'text',
      admin: { description: 'Vercel Blob URL (set after upload completes)' },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Initiated', value: 'initiated' },
        { label: 'Uploaded', value: 'uploaded' },
        { label: 'Finalized', value: 'finalized' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Failed', value: 'failed' },
      ],
      defaultValue: 'initiated',
      required: true,
      admin: { description: 'Status of the upload session' },
    },
    {
      name: 'chatAssetId',
      type: 'relationship',
      relationTo: 'chat-assets',
      admin: { description: 'Reference to created chat-assets document' },
    },
    {
      name: 'expiresAt',
      type: 'date',
      required: true,
      admin: { description: 'Expiration time for orphan cleanup' },
    },
  ],
}
