import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'

export const Prompts: CollectionConfig = {
  slug: 'prompts',
  access: {
    create: adminOnly,
    read: adminOnly, // Endpoint uses overrideAccess: true for prompt fetches
    update: adminOnly,
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'key', 'type', 'status', 'isDefaultForAgentChat', 'updatedAt'],
    group: 'AI',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'Human-readable prompt name' },
    },
    {
      name: 'key',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        description: 'Machine-readable key (e.g., "default-tutor-v1")',
        position: 'sidebar',
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'context',
      options: [
        { label: 'System', value: 'system' },
        { label: 'Context', value: 'context' },
      ],
      index: true,
      admin: {
        description: 'System prompts are always included. Context prompts are lesson-specific.',
        position: 'sidebar',
      },
    },
    {
      name: 'template',
      type: 'textarea',
      required: true,
      admin: {
        description: 'System prompt template for AI tutor',
        rows: 20,
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
        { label: 'Archived', value: 'archived' },
      ],
      index: true,
      admin: { description: 'Only "published" prompts are used at runtime' },
    },
    {
      name: 'isDefaultForAgentChat',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        description: 'Use as fallback when lesson has no prompt',
        position: 'sidebar',
      },
    },
  ],
  timestamps: true,
}
