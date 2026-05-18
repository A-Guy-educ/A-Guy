/**
 * CouponUsages Collection
 *
 * @fileType collection-config
 * @domain payments
 * @pattern usage-log
 * @ai-summary Tracks each coupon redemption for usage counting and per-user limits
 */

import type { CollectionConfig, CollectionAfterChangeHook } from 'payload'

import { adminOnly } from '../access/adminOnly'

/**
 * afterChange: Increment coupon.usesCount when a usage is created.
 * Uses context.skipHooks to prevent infinite loops.
 */
const incrementCouponUsesCount: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc

  const couponId = typeof doc.coupon === 'string' ? doc.coupon : (doc.coupon as { id?: string })?.id
  if (!couponId) return doc

  try {
    await req.payload.update({
      collection: 'coupons',
      id: couponId,
      data: { $inc: { usesCount: 1 } } as Record<string, unknown>,
      context: { skipHooks: true },
      req,
      overrideAccess: true,
    })
  } catch (error) {
    req.payload.logger.error(
      { err: error, couponUsageId: doc.id, couponId },
      'Failed to increment coupon usesCount',
    )
  }

  return doc
}

export const CouponUsages: CollectionConfig = {
  slug: 'coupon-usages',
  access: {
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  hooks: {
    afterChange: [incrementCouponUsesCount],
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
