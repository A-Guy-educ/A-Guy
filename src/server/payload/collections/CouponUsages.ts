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

import type { CollectionAfterChangeHook, CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { createdByField } from '../fields/createdBy'

// afterChange: bump the parent coupon's usesCount on each new usage row.
// checkout/route.ts opts out via context.skipUsesCountHook because it computes
// the increment itself (it needs to read the latest value to detect maxUses
// overflow before recording the usage).
const incrementCouponUsesCount: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc
  if ((req.context as Record<string, unknown>)?.skipUsesCountHook) return doc

  const couponId =
    typeof doc.coupon === 'string' ? doc.coupon : (doc.coupon as { id?: string } | undefined)?.id
  if (!couponId) return doc

  try {
    const current = await req.payload.findByID({
      collection: 'coupons',
      id: couponId,
      depth: 0,
      overrideAccess: true,
    })
    await req.payload.update({
      collection: 'coupons',
      id: couponId,
      data: { usesCount: ((current?.usesCount as number) ?? 0) + 1 },
      context: { skipUsesCountHook: true },
      overrideAccess: true,
      req,
    })
  } catch (error) {
    req.payload.logger.error(
      { err: error, couponUsageId: doc.id, couponId },
      'Failed to increment coupon usesCount from CouponUsages afterChange',
    )
  }

  return doc
}

export const CouponUsages: CollectionConfig = {
  slug: 'coupon-usages',
  admin: {
    useAsTitle: 'coupon',
    defaultColumns: ['coupon', 'transaction', 'user', 'createdAt'],
    group: 'Payments',
    description: 'Tracks coupon usage per transaction',
  },
  access: {
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  hooks: {
    afterChange: [incrementCouponUsesCount],
  },
  fields: [
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
    {
      name: 'usedAt',
      type: 'date',
      admin: {
        description:
          'When the coupon was redeemed (distinct from createdAt for delayed redemptions)',
      },
    },
    createdByField,
  ],
  timestamps: true,
}
