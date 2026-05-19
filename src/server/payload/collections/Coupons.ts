/**
 * Coupons Collection
 *
 * Stores discount coupons that can be applied at checkout.
 *
 * @fileType collection-config
 * @domain payments
 * @pattern coupon
 * @ai-summary Stores discount coupons for checkout
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { createdByField } from '../fields/createdBy'
import { tenantField } from '../fields/tenant'

export const Coupons: CollectionConfig = {
  slug: 'coupons',
  admin: {
    useAsTitle: 'code',
    defaultColumns: ['code', 'discountType', 'discountValue', 'isActive', 'usesCount', 'maxUses'],
    group: 'Payments',
    description: 'Manage discount coupons that can be applied at checkout',
    components: {
      views: {
        list: {
          Component: '@/ui/admin/Coupons/ListView#CouponsListView',
        },
      },
    },
  },
  access: {
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
    read: () => true, // Public read for coupon validation
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
        description: 'The coupon code (case-insensitive, stored uppercase)',
      },
    },
    {
      name: 'discountType',
      type: 'select',
      required: true,
      options: [
        { label: 'Percentage', value: 'percentage' },
        { label: 'Fixed', value: 'fixed' },
      ],
      admin: {
        description:
          'Percentage: discountValue is a percent (0-100). Fixed: discountValue is in agorot.',
      },
    },
    {
      name: 'discountValue',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Percentage (0-100) or fixed amount in agorot',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      index: true,
      admin: {
        description: 'Whether this coupon can be used',
      },
    },
    {
      name: 'validFrom',
      type: 'date',
      admin: {
        description: 'Leave empty for no start restriction',
      },
    },
    {
      name: 'validUntil',
      type: 'date',
      admin: {
        description: 'Leave empty for no expiration',
      },
    },
    {
      name: 'maxUses',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Maximum number of uses (0 = unlimited)',
      },
    },
    {
      name: 'usesCount',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Number of times this coupon has been used',
        readOnly: true,
      },
    },
    {
      name: 'applicableProducts',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      admin: {
        description: 'Leave empty to apply to all products',
      },
    },
    createdByField,
  ],
  timestamps: true,
}
