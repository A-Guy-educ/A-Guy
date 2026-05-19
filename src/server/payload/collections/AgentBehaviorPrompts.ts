/**
 * AgentBehaviorPrompts Collection
 *
 * @fileType collection-config
 * @domain ai
 * @pattern agent-behavior
 * @ai-summary Collection for managing agent behavior prompts that define AI learning agent personality and communication style.
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { contentLocaleField } from '../fields/contentLocale'
import { tenantField } from '../fields/tenant'

export const AgentBehaviorPrompts: CollectionConfig = {
  slug: 'agent-behavior-prompts',
  access: {
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'locale', 'isDefault', 'isEnabled', 'status', 'createdAt'],
    group: 'AI',
  },
  fields: [
    {
      name: 'slug',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Machine-readable identifier (e.g., "motivational-guide", "strict-tutor")',
        position: 'sidebar',
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Human-readable name for admin UI',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Short explanation shown in profile selection (1-2 sentences)',
        rows: 2,
      },
    },
    {
      name: 'template',
      type: 'textarea',
      required: true,
      admin: {
        description:
          'The behavior prompt text defining communication style, recommendations, proactiveness, tone, and learning strategy',
        rows: 20,
      },
    },
    {
      name: 'isDefault',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        description: 'Set as default behavior prompt for the learning agent',
        position: 'sidebar',
      },
    },
    {
      name: 'isEnabled',
      type: 'checkbox',
      defaultValue: true,
      index: true,
      admin: {
        description: 'Disabled prompts are not available for selection',
        position: 'sidebar',
      },
    },
    contentLocaleField,
    tenantField,
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
      admin: {
        description: 'Only "published" prompts are used at runtime',
        position: 'sidebar',
      },
    },
    {
      name: 'priority',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Higher priority prompts are selected over lower ones when multiple match',
        position: 'sidebar',
      },
    },
  ],
  timestamps: true,
}
