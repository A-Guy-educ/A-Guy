/**
 * CourseInstructors Collection
 *
 * @fileType collection-config
 * @domain lms
 * @pattern course-instructor-assignment
 * @ai-summary Links instructors to specific courses with role-based permissions
 */

import type { CollectionConfig } from 'payload'

import { AccountRole } from '@/infra/auth/roles'
import { adminOnly } from '../access/adminOnly'

export const CourseInstructors: CollectionConfig = {
  slug: 'course-instructors',
  admin: {
    description: 'Assign instructors to specific courses',
    defaultColumns: [
      'instructor',
      'course',
      'role',
      'canGrade',
      'canMessageStudents',
      'assignedAt',
    ],
    useAsTitle: 'instructor',
  },
  fields: [
    {
      name: 'instructor',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'The instructor being assigned',
      },
    },
    {
      name: 'course',
      type: 'relationship',
      relationTo: 'courses',
      required: true,
      admin: {
        description: 'The course this instructor is assigned to',
      },
    },
    {
      name: 'role',
      type: 'select',
      defaultValue: 'primary',
      options: [
        { label: 'Primary Instructor', value: 'primary' },
        { label: 'Teaching Assistant', value: 'ta' },
        { label: 'Guest Lecturer', value: 'guest' },
      ],
      admin: {
        description: 'The role of this instructor for the course',
      },
    },
    {
      name: 'canGrade',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Can grade student work for this course',
      },
    },
    {
      name: 'canMessageStudents',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Can send messages to students in this course',
      },
    },
    {
      name: 'assignedAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'When this instructor was assigned to the course',
      },
    },
  ],
  access: {
    read: ({ req: { user } }) => {
      if (!user || user.collection !== 'users') return false
      if (user.role === AccountRole.Admin) return true
      // Instructors can read their own assignments
      if (user.role === AccountRole.Instructor) {
        return {
          instructor: {
            equals: user.id,
          },
        }
      }
      return false
    },
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        // Set assignedAt on creation if not provided
        if (!data.assignedAt) {
          data.assignedAt = new Date().toISOString()
        }
        return data
      },
    ],
  },
  timestamps: true,
}
