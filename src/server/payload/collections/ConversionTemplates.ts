import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { tenantField } from '../fields/tenant'

export const ConversionTemplates: CollectionConfig = {
  slug: 'conversion-templates',

  access: {
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },

  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'description', 'tenant', 'isDefault', 'updatedAt'],
    group: 'Tools',
  },

  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: { description: 'Template name (e.g., "Standard Math Extraction")' },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: { description: 'When to use this template' },
    },
    tenantField,
    {
      name: 'isDefault',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Use as default for new conversions' },
    },

    // ===== Configuration =====
    {
      name: 'segmentation',
      type: 'group',
      fields: [{ name: 'pagesPerSegment', type: 'number', defaultValue: 2, min: 1, max: 10 }],
    },
    {
      name: 'extraction',
      type: 'group',
      fields: [
        {
          name: 'mode',
          type: 'select',
          defaultValue: 'structured',
          options: [
            { label: 'Structured Only', value: 'structured' },
            { label: 'Flexible', value: 'flexible' },
          ],
        },
        {
          name: 'exerciseTypes',
          type: 'select',
          hasMany: true,
          defaultValue: ['mcq', 'free_response', 'select'],
          options: [
            { label: 'Multiple Choice', value: 'mcq' },
            { label: 'Free Response', value: 'free_response' },
            { label: 'Selection', value: 'select' },
            { label: 'Fill in Blank', value: 'fill_blank' },
            { label: 'Matching', value: 'matching' },
          ],
        },
        { name: 'customInstructions', type: 'textarea' },
      ],
    },
    {
      name: 'reviewMode',
      type: 'select',
      defaultValue: 'segment',
      options: [
        { label: 'Auto-approve All', value: 'auto' },
        { label: 'Review After Each Segment', value: 'segment' },
        { label: 'Review All at End', value: 'batch' },
        { label: 'Manual Step-by-Step', value: 'manual' },
      ],
    },

    // ===== Prompts =====
    {
      name: 'extractorPrompt',
      type: 'relationship',
      relationTo: 'prompts',
      filterOptions: { usage: { equals: 'extractor' }, status: { equals: 'published' } },
    },
    {
      name: 'verifierPrompt',
      type: 'relationship',
      relationTo: 'prompts',
      filterOptions: { usage: { equals: 'verifier' }, status: { equals: 'published' } },
    },

    // ===== Additional Rounds =====
    {
      name: 'additionalRounds',
      type: 'array',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'prompt', type: 'relationship', relationTo: 'prompts', required: true },
        { name: 'targetField', type: 'text', required: true },
        {
          name: 'triggerCondition',
          type: 'select',
          defaultValue: 'always',
          options: [
            { label: 'Always', value: 'always' },
            { label: 'Has Image', value: 'has_image' },
            { label: 'Has Table', value: 'has_table' },
            { label: 'Has Diagram', value: 'has_diagram' },
            { label: 'Custom', value: 'custom' },
          ],
        },
        { name: 'customCondition', type: 'code' },
        { name: 'order', type: 'number', required: true, defaultValue: 1 },
      ],
    },
  ],

  timestamps: true,
}
