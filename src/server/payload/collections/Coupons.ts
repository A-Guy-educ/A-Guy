/**
 * Coupons Collection
 *
 * @fileType collection-config
 * @domain payments
 * @pattern discount-code
 * @ai-summary Stores discount coupon codes for checkout (percentage or fixed amount)
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { anyone } from '../access/anyone'
import { createdByField } from '../fields/createdBy'

export const Coupons: CollectionConfig = {
  slug: 'coupons',
  access: {
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
    read: anyone, // Public read enables checkout validation without auth
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (!data) return data

        // 1. Normalize code to uppercase and trim
        if (typeof data.code === 'string') {
          data.code = data.code.trim().toUpperCase()
        }

        // 2. Reject percentage > 100
        if (data.discountType === 'percentage' && (data.discountValue ?? 0) > 100) {
          throw new Error('Percentage discount cannot exceed 100%')
        }

        // 3. Validate date range
        if (data.validFrom && data.validUntil) {
          if (new Date(data.validFrom) > new Date(data.validUntil)) {
            throw new Error('validFrom must be before validUntil')
          }
        }

        return data
      },
    ],
  },
  admin: {
    useAsTitle: 'code',
    defaultColumns: [
      'code',
      'discountType',
      'discountValue',
      'usesCount',
      'maxUses',
      'validUntil',
      'isActive',
    ],
    group: 'Payments',
  },
  fields: [
    {
      name: 'code',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Coupon code (stored uppercase, case-insensitive in app logic)' },
    },
    {
      name: 'discountType',
      type: 'select',
      required: true,
      options: [
        { label: 'אחוז', value: 'percentage' },
        { label: 'סכום קבוע', value: 'fixed' },
      ],
    },
    {
      name: 'discountValue',
      type: 'number',
      required: true,
      min: 0,
      admin: { description: 'Percentage (0–100) or agorot amount depending on discountType' },
    },
    {
      name: 'currency',
      type: 'select',
      required: true,
      defaultValue: 'ILS',
      options: [
        { label: 'ILS', value: 'ILS' },
        { label: 'USD', value: 'USD' },
        { label: 'EUR', value: 'EUR' },
      ],
      admin: { description: 'Currency for fixed discount' },
    },
    {
      name: 'maxUses',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: { description: 'Maximum uses (0 = unlimited)' },
    },
    {
      name: 'usesCount',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: { description: 'How many times this coupon has been used', readOnly: true },
    },
    {
      name: 'validFrom',
      type: 'date',
      admin: { description: 'מתחילת תוקף (אם לא מוגדר — תקף מעכשיו)' },
    },
    {
      name: 'validUntil',
      type: 'date',
      admin: { description: 'סוף תוקף (אם לא מוגדר — ללא הגבלה)' },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      required: true,
      defaultValue: true,
    },
    {
      name: 'applicableProducts',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      admin: { description: 'אם ריק — חל על כל המוצרים' },
    },
    {
      name: 'maxUsesPerUser',
      type: 'number',
      defaultValue: 1,
      admin: { description: 'מקסימום שימושים למשתמש' },
    },
    createdByField,
  ],
  timestamps: true,
}
