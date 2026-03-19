/**
<<<<<<< HEAD
 * Access Codes Collection
 *
 * @fileType collection-config
 * @domain courses
 * @pattern access-code-gate
 * @ai-summary Collection for storing access codes that unlock restricted lessons
=======
 * AccessCodes Collection
 *
 * @fileType collection-config
 * @domain entitlements
 * @pattern access-control
 * @ai-summary Stores coupon/access codes that grant entitlements to courses
>>>>>>> origin/dev
 */

import type { CollectionConfig } from 'payload'

<<<<<<< HEAD
import { adminOnly } from '@/server/payload/access/adminOnly'
import { tenantField } from '@/server/payload/fields/tenant'
import { createdByField } from '@/server/payload/fields/createdBy'
=======
import { adminOnly } from '../access/adminOnly'
import { createdByField } from '../fields/createdBy'
import { tenantField } from '../fields/tenant'
>>>>>>> origin/dev

export const AccessCodes: CollectionConfig = {
  slug: 'access-codes',
  admin: {
<<<<<<< HEAD
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
=======
    useAsTitle: 'code',
    defaultColumns: ['code', 'course', 'maxUses', 'currentUses', 'isActive', 'expiresAt'],
    group: 'Access Control',
    description: 'Manage access codes that grant course entitlements',
  },
  access: {
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
    read: adminOnly,
  },
  fields: [
    tenantField,
>>>>>>> origin/dev
    {
      name: 'code',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
<<<<<<< HEAD
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
=======
        description: 'The code students will enter (e.g., MACCABI-2024)',
      },
    },
    {
      name: 'course',
      type: 'relationship',
      relationTo: 'courses',
      required: true,
      index: true,
      admin: {
        description: 'The course this code grants access to',
      },
    },
    {
      name: 'maxUses',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Maximum number of times this code can be used (0 = unlimited)',
      },
    },
    {
      name: 'currentUses',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'How many times this code has been redeemed',
        readOnly: true,
      },
    },
>>>>>>> origin/dev
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
<<<<<<< HEAD
        description: 'Whether this code is currently valid',
      },
    },
    // Expiration date
=======
        description: 'Whether this code can currently be redeemed',
      },
    },
>>>>>>> origin/dev
    {
      name: 'expiresAt',
      type: 'date',
      admin: {
<<<<<<< HEAD
        description: 'Expiration date (leave empty for no expiration)',
      },
    },
    // Tenant
    tenantField,
    // Created by
    createdByField,
  ],
  timestamps: true,
=======
        description: 'Optional expiration date (leave empty for no expiry)',
      },
    },
    createdByField,
  ],
>>>>>>> origin/dev
}
