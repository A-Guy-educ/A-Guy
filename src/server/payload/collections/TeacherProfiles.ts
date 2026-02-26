/**
 * TeacherProfiles Collection
 *
 * @fileType collection-config
 * @domain ai
 * @pattern teacher-profile
 * @ai-summary Collection for managing teacher profiles that define AI chat behavior
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'

export const TeacherProfiles: CollectionConfig = {
  slug: 'teacher_profiles',
  access: {
    create: adminOnly,
    read: adminOnly, // OverrideAccess: true used server-side for authorized reads
    update: adminOnly,
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label', 'slug', 'systemPrompt', 'isEnabled', 'createdAt'],
    group: 'AI',
  },
  fields: [
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Machine-readable identifier (e.g., "teacher_strict")',
        position: 'sidebar',
      },
    },
    {
      name: 'label',
      type: 'text',
      required: true,
      admin: {
        description: 'Human-readable name displayed in UI',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Short explanation shown in profile selection UI (1-2 sentences)',
        rows: 2,
      },
    },
    {
      name: 'systemPrompt',
      type: 'relationship',
      relationTo: 'prompts',
      required: true,
      admin: {
        description: "The prompt template that defines this teacher's behavior",
      },
    },
    {
      name: 'isEnabled',
      type: 'checkbox',
      defaultValue: true,
      index: true,
      admin: {
        description: 'Disabled profiles are not available for selection',
      },
    },
  ],
  timestamps: true,
}
