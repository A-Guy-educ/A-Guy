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

import { enrollmentProgressAccess } from '@/server/payload/access/enrollmentProgressAccess'
import { authenticated } from '@/server/payload/access/authenticated'

/**
 * Populates the user field from the enrollment's user relationship.
 * This enables row-level access control via enrollmentProgressAccess.
 */
const populateUserFromEnrollment = async ({
  data,
  req,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
  req: { payload: import('payload').Payload }
}) => {
  if (!data.enrollment) return data

  // Fetch the enrollment to get its user
  const enrollment = await req.payload.findByID({
    collection: 'enrollments',
    id: data.enrollment,
    depth: 0,
    overrideAccess: true,
  })

  if (enrollment?.user) {
    data.user = typeof enrollment.user === 'string' ? enrollment.user : enrollment.user.id
  }

  return data
}

export const EnrollmentProgress: CollectionConfig = {
  slug: 'enrollment-progress',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['enrollment', 'lesson', 'progress', 'lastAccessedAt'],
  },
  access: {
    create: authenticated,
    read: enrollmentProgressAccess,
    update: enrollmentProgressAccess,
    delete: enrollmentProgressAccess,
  },
  hooks: {
    beforeChange: [populateUserFromEnrollment],
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        description: 'The user who owns this progress (populated from enrollment)',
        readOnly: true,
      },
    },
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
    // Access control - user lookups
    { fields: ['user', 'lesson'] },
  ],
}
