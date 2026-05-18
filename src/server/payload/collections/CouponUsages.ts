/**
 * CouponUsages Collection
 *
 * Records each use of a coupon for auditing and tracking.
 *
 * @fileType collection-config
 * @domain payments
 * @pattern coupon
 * @ai-summary Records coupon usage for auditing
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { createdByField } from '../fields/createdBy'
import { tenantField } from '../fields/tenant'

export const CouponUsages: CollectionConfig = {
  slug: 'coupon-usages',
  admin: {
    useAsTitle: 'coupon',
    defaultColumns: ['coupon', 'transaction', 'user', 'createdAt'],
    group: 'Payments',
    description: 'Tracks coupon usage per transaction',
  },
  access: {
    create: () => true, // Public create for recording usage during checkout
    read: adminOnly,
    update: () => false, // No updates allowed
    delete: adminOnly,
  },
  fields: [
    tenantField,
    {
      name: 'coupon',
      type: 'relationship',
      relationTo: 'coupons',
      required: true,
      index: true,
      admin: {
        description: 'The coupon that was used',
      },
    },
    {
      name: 'transaction',
      type: 'relationship',
      relationTo: 'transactions',
      required: true,
      index: true,
      admin: {
        description: 'The checkout transaction where the coupon was applied',
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        description: 'The user who used the coupon',
      },
    },
    createdByField,
  ],
  timestamps: true,
}
