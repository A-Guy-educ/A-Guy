/**
 * Enrollments Collection
 *
 * Stores course enrollment records with status tracking, history, and metadata.
 * Replaces the legacy courseEntitlements array on User documents.
 *
 * @fileType collection-config
 * @domain entitlements
 * @pattern enrollment, progress-tracking
 * @ai-summary Course enrollment records with status, source tracking, and history
 */

import type { CollectionConfig } from 'payload'

import { adminOrSelf } from '@/server/payload/access/adminOrSelf'
import { authenticated } from '@/server/payload/access/authenticated'

export const Enrollments: CollectionConfig = {
  slug: 'enrollments',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['user', 'course', 'status', 'grantMethod', 'source', 'enrolledAt'],
  },
  access: {
    create: authenticated,
    read: adminOrSelf,
    update: adminOrSelf,
    delete: adminOrSelf,
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
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      required: true,
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Expired', value: 'expired' },
      ],
      index: true,
      admin: {
        description: 'Current enrollment status',
      },
    },
    {
      name: 'grantMethod',
      type: 'select',
      required: true,
      options: [
        { label: 'Admin Grant', value: 'admin' },
        { label: 'Payment', value: 'payment' },
        { label: 'Access Code', value: 'code' },
      ],
      admin: {
        description: 'How the enrollment was granted',
        readOnly: true,
      },
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      options: [
        { label: 'Dashboard', value: 'dashboard' },
        { label: 'API', value: 'api' },
        { label: 'Self', value: 'self' },
        { label: 'Invite', value: 'invite' },
      ],
      admin: {
        description: 'Origin of the enrollment',
        readOnly: true,
      },
    },
    {
      name: 'enrolledAt',
      type: 'date',
      defaultValue: () => new Date().toISOString(),
      required: true,
      index: true,
      admin: {
        description: 'When the enrollment was created',
      },
    },
    {
      name: 'cancelledAt',
      type: 'date',
      required: false,
      admin: {
        description: 'When the enrollment was cancelled',
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      required: false,
      admin: {
        description: 'When the enrollment expires (for time-limited access)',
      },
    },
    {
      name: 'metadata',
      type: 'group',
      fields: [
        {
          name: 'accessCodeId',
          type: 'text',
          required: false,
          admin: {
            description: 'Access code used for enrollment (if applicable)',
          },
        },
        {
          name: 'paymentId',
          type: 'text',
          required: false,
          admin: {
            description: 'Payment reference (for future payment integration)',
          },
        },
        {
          name: 'grantedBy',
          type: 'text',
          required: false,
          admin: {
            description: 'Admin user ID who granted the enrollment',
          },
        },
      ],
    },
  ],
  timestamps: true,
  indexes: [
    // Unique constraint: one enrollment per user+course
    { fields: ['user', 'course'], unique: true },
    // Course enrollment reports
    { fields: ['course', 'status'] },
    // Status reports
    { fields: ['status', 'enrolledAt'] },
    // Access checks
    { fields: ['user', 'status'] },
  ],
}
