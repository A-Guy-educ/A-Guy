import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { tenantField } from '../fields/tenant'

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
    defaultColumns: ['title', 'key', 'type', 'status', 'usage', 'tenant', 'updatedAt'],
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
        // NEW: Enrichment round prompts
        { label: 'Diagram Analyzer', value: 'round_diagram' },
        { label: 'Table Extractor', value: 'round_table' },
        { label: 'Hint Generator', value: 'round_hints' },
        { label: 'Solution Extractor', value: 'round_solution' },
        { label: 'Accessibility Describer', value: 'round_accessibility' },
        { label: 'Custom Enrichment', value: 'round_custom' },
      ],
      defaultValue: 'chat',
      admin: {
        description:
          'Purpose of this prompt: chat, PDF extraction, verification, or enrichment rounds',
        position: 'sidebar',
      },
    },
  ],
  timestamps: true,
}
