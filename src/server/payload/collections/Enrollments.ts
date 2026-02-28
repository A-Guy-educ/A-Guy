/**
 * Enrollments Collection
 *
 * @fileType collection-config
 * @domain enrollment
 * @pattern user-owned, enrollment-tracking
 * @ai-summary Track user course enrollments with access control
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/server/payload/access/adminOnly'
import { authenticated } from '@/server/payload/access/authenticated'
import { authenticatedOrOwner } from '@/server/payload/access/authenticatedOrOwner'

export const Enrollments: CollectionConfig = {
  slug: 'enrollments',
  access: {
    create: authenticated,
    read: authenticatedOrOwner,
    update: adminOnly, // Only admins can modify enrollments
    delete: adminOnly, // Only admins can delete enrollments
  },
  admin: {
    useAsTitle: 'course',
    defaultColumns: ['user', 'course', 'status', 'accessType', 'enrolledAt'],
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        description: 'The user who is enrolled',
      },
    },
    {
      name: 'course',
      type: 'relationship',
      relationTo: 'courses',
      required: true,
      index: true,
      admin: {
        description: 'The course the user is enrolled in',
      },
    },
    {
      name: 'enrolledAt',
      type: 'date',
      admin: {
        description: 'When the user enrolled in the course',
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Completed', value: 'completed' },
      ],
      defaultValue: 'active',
      required: true,
      index: true,
      admin: {
        description: 'Current enrollment status',
      },
    },
    {
      name: 'accessType',
      type: 'select',
      options: [
        { label: 'Free', value: 'free' },
        { label: 'Paid', value: 'paid' },
      ],
      defaultValue: 'paid',
      required: true,
      admin: {
        description: 'Access type - overrides course default access settings',
      },
    },
  ],
  indexes: [
    // Unique compound index to prevent duplicate enrollments
    {
      fields: ['user', 'course'],
      unique: true,
    },
  ],
  timestamps: true,
}
