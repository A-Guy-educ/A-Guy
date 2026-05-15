/**
 * CouponUsages Collection
 *
 * @fileType collection-config
 * @domain payments
 * @pattern usage-log
 * @ai-summary Tracks each coupon redemption for usage counting and per-user limits
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'

export const CouponUsages: CollectionConfig = {
  slug: 'coupon-usages',
  access: {
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'usedAt',
    defaultColumns: ['coupon', 'user', 'transaction', 'usedAt'],
    group: 'Payments',
  },
  fields: [
    {
      name: 'coupon',
      type: 'relationship',
      relationTo: 'coupons',
      required: true,
      index: true,
      admin: { description: 'The coupon that was used' },
    },
    {
      name: 'transaction',
      type: 'relationship',
      relationTo: 'transactions',
      required: true,
      index: true,
      admin: { description: 'The transaction where the coupon was applied' },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: { description: 'The user who redeemed the coupon' },
    },
    {
      name: 'usedAt',
      type: 'date',
      required: true,
      admin: { description: 'When the coupon was redeemed' },
    },
  ],
  timestamps: true,
}
