/**
 * Access Codes Collection
 *
 * @fileType collection-config
 * @domain courses
 * @pattern access-code-gate
 * @ai-summary Collection for storing access codes that unlock restricted lessons
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/server/payload/access/adminOnly'
import { tenantField } from '@/server/payload/fields/tenant'
import { createdByField } from '@/server/payload/fields/createdBy'

export const AccessCodes: CollectionConfig = {
  slug: 'access-codes',
  admin: {
    useAsTitle: 'label',
    defaultColumns: [
      'code',
      'label',
      'scopeType',
      'scopeTarget',
      'currentRedemptions',
      'maxRedemptions',
      'isActive',
      'expiresAt',
    ],
  },
  access: {
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    // Code string (unique identifier)
    {
      name: 'code',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'The access code string (e.g., MACCABI-2024-FREE)',
      },
    },
    // Friendly label for admin reference
    {
      name: 'label',
      type: 'text',
      required: true,
      admin: {
        description: 'Friendly name for admin reference (e.g., "Maccabi School 2024")',
      },
    },
    // Scope type - lesson, course, or global
    {
      name: 'scopeType',
      type: 'select',
      required: true,
      defaultValue: 'lesson',
      options: [{ label: 'Lesson', value: 'lesson' }],
      admin: {
        description: 'Scope of content this code unlocks',
      },
    },
    // Target lesson (if scopeType is lesson)
    {
      name: 'scopeTarget',
      type: 'relationship',
      relationTo: 'lessons',
      required: true,
      admin: {
        description: 'The lesson this code unlocks',
        condition: (data) => data?.scopeType === 'lesson',
      },
    },
    // Max redemptions (null = unlimited)
    {
      name: 'maxRedemptions',
      type: 'number',
      min: 1,
      admin: {
        description:
          'Maximum number of times this code can be redeemed (leave empty for unlimited)',
      },
    },
    // Current redemption count (auto-incremented)
    {
      name: 'currentRedemptions',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        description: 'Number of times this code has been redeemed',
      },
    },
    // Active toggle
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this code is currently valid',
      },
    },
    // Expiration date
    {
      name: 'expiresAt',
      type: 'date',
      admin: {
        description: 'Expiration date (leave empty for no expiration)',
      },
    },
    // Tenant
    tenantField,
    // Created by
    createdByField,
  ],
  timestamps: true,
}
