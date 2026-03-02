import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { tenantField } from '../fields/tenant'
import { contentLocaleField } from '../fields/contentLocale'
import { enforcePromptKeyLocaleUniqueness } from '../hooks/validateLocaleUniqueness'

export const Prompts: CollectionConfig = {
  slug: 'prompts',
  access: {
    create: adminOnly,
    read: adminOnly, // OverrideAccess: true used server-side in queue endpoint
    update: adminOnly,
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: [
      'title',
      'promptKey',
      'locale',
      'type',
      'status',
      'usage',
      'tenant',
      'updatedAt',
    ],
    group: 'AI',
  },
  hooks: {
    beforeChange: [enforcePromptKeyLocaleUniqueness],
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
      name: 'promptKey',
      type: 'text',
      index: true,
      admin: {
        description: 'Machine-readable key (e.g., "default-tutor-v1")',
        position: 'sidebar',
      },
    },
    // Content locale — uniqueness is per (promptKey, locale), enforced by hook
    contentLocaleField,
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'context',
      options: [
        { label: 'System', value: 'system' },
        { label: 'Context', value: 'context' },
        { label: 'Persona', value: 'persona' },
      ],
      index: true,
      admin: {
        description:
          'System prompts are always included. Context prompts are lesson-specific. Persona prompts define teacher identity.',
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
    // ADD: tenant scoping
    tenantField,
    // ADD: usage for conversion (extractor/verifier) - NOT a replacement for type field
    {
      name: 'usage',
      type: 'select',
      options: [
        { label: 'Chat', value: 'chat' },
        { label: 'PDF Extractor', value: 'extractor' },
        { label: 'PDF Verifier', value: 'verifier' },
      ],
      defaultValue: 'chat',
      admin: {
        description:
          'Purpose of this prompt: chat conversation, PDF extraction, or PDF verification',
        position: 'sidebar',
      },
    },
  ],
  timestamps: true,
}
