/**
 * TeacherProfiles Collection
 *
 * @fileType collection-config
 * @domain ai
 * @pattern teacher-profile
 * @ai-summary Collection for managing teacher profiles that define AI chat behavior.
 *   Uses per-locale documents (contentLocaleField + translatedFromField) consistent
 *   with Courses, Chapters, and Lessons.
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { contentLocaleField } from '../fields/contentLocale'
import { translatedFromField } from '../fields/translatedFrom'
import { enforceFieldLocaleUniqueness } from '../hooks/validateLocaleUniqueness'

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
    defaultColumns: ['label', 'slug', 'locale', 'systemPrompt', 'isEnabled', 'createdAt'],
    group: 'AI',
  },
  hooks: {
    beforeChange: [enforceFieldLocaleUniqueness('teacher_profiles')],
  },
  fields: [
    contentLocaleField,
    translatedFromField('teacher_profiles'),
    {
      name: 'slug',
      type: 'text',
      required: true,
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
