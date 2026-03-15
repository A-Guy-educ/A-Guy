/**
 * UserEntitlements Collection
 *
 * @fileType collection-config
 * @domain entitlements
 * @pattern access-control
 * @ai-summary Tracks which users have access to paid courses/lessons
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { authenticatedOrOwner } from '../access/authenticatedOrOwner'
import { createdByField } from '../fields/createdBy'
import { tenantField } from '../fields/tenant'

export const UserEntitlements: CollectionConfig = {
  slug: 'user-entitlements',
  admin: {
    useAsTitle: 'grantMethod',
    defaultColumns: [
      'user',
      'contentType',
      'course',
      'lesson',
      'grantMethod',
      'expiresAt',
      'createdAt',
    ],
    group: 'Access Control',
    description: 'Manage user access to paid courses and lessons',
  },
  access: {
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
    read: authenticatedOrOwner,
  },
  fields: [
    tenantField,
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        description: 'The student who has access',
      },
    },
    {
      name: 'contentType',
      type: 'select',
      required: true,
      options: [
        { label: 'Course', value: 'course' },
        { label: 'Lesson', value: 'lesson' },
      ],
      admin: {
        description: 'Whether this entitlement is for a course or a specific lesson',
      },
    },
    {
      name: 'course',
      type: 'relationship',
      relationTo: 'courses',
      index: true,
      admin: {
        description: 'The course to grant access to',
        condition: (data) => data?.contentType === 'course',
      },
    },
    {
      name: 'lesson',
      type: 'relationship',
      relationTo: 'lessons',
      index: true,
      admin: {
        description: 'The specific lesson to grant access to',
        condition: (data) => data?.contentType === 'lesson',
      },
    },
    {
      name: 'grantMethod',
      type: 'select',
      required: true,
      defaultValue: 'admin',
      options: [
        { label: 'Admin Grant', value: 'admin' },
        { label: 'Payment', value: 'payment' },
        { label: 'Access Code', value: 'code' },
      ],
      admin: {
        description: 'How this entitlement was granted',
      },
    },
    {
      name: 'grantedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'The admin who granted this entitlement',
        condition: (data) => data?.grantMethod === 'admin',
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      admin: {
        description: 'Optional expiration date (leave empty for permanent)',
      },
    },
    createdByField,
  ],
}
