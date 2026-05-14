/**
 * EnrollmentProgress Collection
 *
 * Tracks lesson progress within an enrollment.
 *
 * @fileType collection-config
 * @domain progress-tracking
 * @pattern enrollment, progress-tracking
 * @ai-summary Lesson progress tracking per enrollment
 */

import type { CollectionConfig } from 'payload'

import { adminOrSelf } from '@/server/payload/access/adminOrSelf'
import { authenticated } from '@/server/payload/access/authenticated'

export const EnrollmentProgress: CollectionConfig = {
  slug: 'enrollment-progress',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['enrollment', 'lesson', 'progress', 'lastAccessedAt'],
  },
  access: {
    create: authenticated,
    read: adminOrSelf,
    update: adminOrSelf,
    delete: adminOrSelf,
  },
  fields: [
    {
      name: 'enrollment',
      type: 'relationship',
      relationTo: 'enrollments',
      required: true,
      index: true,
      admin: {
        description: 'The enrollment this progress belongs to',
      },
    },
    {
      name: 'lesson',
      type: 'relationship',
      relationTo: 'lessons',
      required: true,
      index: true,
      admin: {
        description: 'The lesson this progress is for',
      },
    },
    {
      name: 'progress',
      type: 'number',
      min: 0,
      max: 100,
      defaultValue: 0,
      admin: {
        description: 'Progress percentage (0-100)',
      },
    },
    {
      name: 'completedAt',
      type: 'date',
      required: false,
      admin: {
        description: 'When the lesson was marked as completed',
      },
    },
    {
      name: 'lastAccessedAt',
      type: 'date',
      defaultValue: () => new Date().toISOString(),
      admin: {
        description: 'When the lesson was last accessed',
      },
    },
  ],
  timestamps: true,
  indexes: [
    // Unique constraint: one progress record per enrollment+lesson
    { fields: ['enrollment', 'lesson'], unique: true },
    // Recent access tracking
    { fields: ['enrollment', 'lastAccessedAt'] },
  ],
}
