/**
 * UserProgress Collection
 *
 * @fileType collection-config
 * @domain progress-tracking
 * @pattern user-owned, progress-tracking
 * @ai-summary User progress tracking for chapters, lessons, and exercises
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { authenticated } from '@/access/authenticated'
import { authenticatedOrOwner } from '@/access/authenticatedOrOwner'
import { tenantField } from '@/fields/tenant'

export const UserProgress: CollectionConfig = {
  slug: 'user-progress',
  access: {
    create: authenticated,
    read: authenticatedOrOwner,
    update: authenticatedOrOwner,
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'user',
    defaultColumns: ['user', 'gradeLevel', 'updatedAt'],
  },
  fields: [
    // Tenant
    tenantField,
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        description: 'The user this progress belongs to',
      },
    },
    {
      name: 'gradeLevel',
      type: 'text',
      index: true,
      admin: {
        description: 'Grade level (e.g., "8", "ח")',
      },
    },
    {
      name: 'progressRecords',
      type: 'array',
      fields: [
        {
          name: 'recordType',
          type: 'select',
          options: [
            { label: 'Chapter', value: 'chapter' },
            { label: 'Lesson', value: 'lesson' },
            { label: 'Exercise', value: 'exercise' },
          ],
          required: true,
        },
        {
          name: 'recordId',
          type: 'text',
          required: true,
          index: true,
          admin: {
            description: 'ID of the chapter, lesson, or exercise',
          },
        },
        {
          name: 'completionPercentage',
          type: 'number',
          min: 0,
          max: 100,
          defaultValue: 0,
          admin: {
            description: 'Completion percentage (0-100)',
          },
        },
        {
          name: 'status',
          type: 'select',
          options: [
            { label: 'Not Started', value: 'not_started' },
            { label: 'In Progress', value: 'in_progress' },
            { label: 'Completed', value: 'completed' },
          ],
          defaultValue: 'not_started',
        },
        {
          name: 'score',
          type: 'number',
          min: 0,
          max: 100,
          admin: {
            description: 'Score for exercises (0-100)',
          },
        },
        {
          name: 'lastAccessedAt',
          type: 'date',
          admin: {
            description: 'Last time this record was accessed',
          },
        },
      ],
    },
  ],
  timestamps: true,
}
