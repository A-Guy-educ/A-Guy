/**
 * AccessCodes Collection
 *
 * @fileType collection-config
 * @domain entitlements
 * @pattern access-control
 * @ai-summary Stores coupon/access codes that grant entitlements to courses
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { createdByField } from '../fields/createdBy'
import { tenantField } from '../fields/tenant'

export const AccessCodes: CollectionConfig = {
  slug: 'access-codes',
  admin: {
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
    {
      name: 'code',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
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
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this code can currently be redeemed',
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      admin: {
        description: 'Optional expiration date (leave empty for no expiry)',
      },
    },
    createdByField,
  ],
}
