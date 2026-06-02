/**
 * Coupons Collection
 *
 * Stores discount coupons (percentage or fixed amount) that can be applied at
 * checkout. Codes are stored uppercase; comparison is case-insensitive.
 *
 * @fileType collection-config
 * @domain payments
 * @pattern discount-code
 * @ai-summary Stores discount coupon codes for checkout (percentage or fixed amount)
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { createdByField } from '../fields/createdBy'
import { optionalTenantField } from '../fields/tenant'
import {
  afterReadCouponStatus,
  afterReadCouponUsageDisplay,
  afterReadCouponExpiresDisplay,
} from '../hooks/coupons/computeListDisplayFields-hook'
import {
  afterReadDiscountValue,
  afterReadCouponDiscountDisplay,
} from '../hooks/coupons/discountValue-hook'

export const Coupons: CollectionConfig = {
  slug: 'coupons',
  admin: {
    useAsTitle: 'code',
    defaultColumns: [
      'code',
      'status',
      'usageDisplay',
      'discountDisplay',
      'discountType',
      'discountValue',
      'expiresDisplay',
      'isActive',
    ],
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
    read: adminOnly,
  },
  hooks: {
    beforeChange: [
      ({ data, req }) => {
        if (!data) return data

        if (typeof data.code === 'string') {
          data.code = data.code.trim().toUpperCase()
        }

        if (data.discountType === 'percentage' && (data.discountValue ?? 0) > 100) {
          throw new Error('Percentage discount cannot exceed 100%')
        }

        if (data.discountType === 'fixed') {
          // Convert shekels → agorot (×100) for storage.
          // Always multiply: admin enters shekels, we store in agorot.
          data.discountValue = Math.round((data.discountValue ?? 0) * 100)

          // Warn on suspiciously large fixed values (> 100,000 shekels / 10M agorot)
          // — likely admin entered agorot by mistake instead of shekels.
          if ((data.discountValue ?? 0) > 10_000_000) {
            req.payload.logger.warn(
              { couponCode: data.code, discountValue: data.discountValue },
              `Suspicious fixed discount value ${data.discountValue} on coupon "${data.code}" — may indicate agorot was entered instead of shekels.`,
            )
          }
        }

        if (data.validFrom && data.validUntil) {
          if (new Date(data.validFrom) > new Date(data.validUntil)) {
            throw new Error('validFrom must be before validUntil')
          }
        }

        return data
      },
    ],
  },
  fields: [
    // Tenant (optional - null/empty means global/legacy coupon accessible to all)
    optionalTenantField,
    {
      name: 'code',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Coupon code (stored uppercase, case-insensitive in app logic)',
      },
    },
    {
      name: 'discountType',
      type: 'select',
      required: true,
      options: [
        { label: 'אחוז', value: 'percentage' },
        { label: 'סכום קבוע', value: 'fixed' },
      ],
      admin: {
        description:
          'Percentage: discountValue is a percent (0–100). Fixed: discountValue is in ILS (e.g. 30 = ₪30 off).',
      },
    },
    {
      name: 'discountValue',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description:
          'Percentage: % off (0–100, e.g. 30 = 30% off). Fixed: ILS amount off (e.g. 30 = ₪30 off, stored as agorot).',
      },
      hooks: {
        // Convert stored agorot → shekels for display when type is fixed
        afterRead: [afterReadDiscountValue],
      },
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
      admin: {
        description: 'Currency for fixed-amount discounts',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      required: true,
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
        description: 'מתחילת תוקף (אם לא מוגדר — תקף מעכשיו)',
      },
    },
    {
      name: 'validUntil',
      type: 'date',
      admin: {
        description: 'סוף תוקף (אם לא מוגדר — ללא הגבלה)',
      },
    },
    {
      name: 'maxUses',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: {
        description: 'Maximum number of uses (0 = unlimited)',
      },
    },
    {
      name: 'usesCount',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: {
        description: 'Number of times this coupon has been used',
        readOnly: true,
      },
    },
    {
      name: 'maxUsesPerUser',
      type: 'number',
      defaultValue: 1,
      admin: {
        description: 'מקסימום שימושים למשתמש',
      },
    },
    {
      name: 'applicableProducts',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      admin: {
        description: 'אם ריק — חל על כל המוצרים',
      },
    },
    // ─── Usage progress bar (detail view) ────────────────────────────────────────
    // Shows a progress bar when maxUses > 0
    {
      name: 'usageProgress',
      type: 'ui',
      admin: {
        components: {
          Field: '@/ui/admin/Coupons/UsageProgressField#CouponUsageProgress',
        },
      },
    },
    // ─── Virtual derived fields for admin list view ───────────────────────────
    // These fields are computed via afterRead hooks and are read-only.
    {
      name: 'status',
      type: 'text',
      admin: {
        components: {
          Cell: '@/ui/admin/Coupons/Cells/StatusCell#CouponStatusCell',
        },
      },
      hooks: {
        afterRead: [afterReadCouponStatus],
      },
    },
    {
      name: 'usageDisplay',
      type: 'text',
      admin: {
        components: {
          Cell: '@/ui/admin/Coupons/Cells/UsageCell#CouponUsageCell',
        },
      },
      hooks: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FieldHookArgs vs FieldHook generic mismatch
        afterRead: [afterReadCouponUsageDisplay as any],
      },
    },
    {
      name: 'expiresDisplay',
      type: 'text',
      admin: {
        components: {
          Cell: '@/ui/admin/Coupons/Cells/ExpiresCell#CouponExpiresCell',
        },
      },
      hooks: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FieldHookArgs vs FieldHook generic mismatch
        afterRead: [afterReadCouponExpiresDisplay as any],
      },
    },
    // ─── Human-readable discount display ────────────────────────────────────
    {
      name: 'discountDisplay',
      type: 'text',
      admin: {
        components: {
          Cell: '@/ui/admin/Coupons/Cells/DiscountDisplayCell#CouponDiscountDisplayCell',
        },
        description: 'Formatted discount for quick scanning',
      },
      hooks: {
        afterRead: [afterReadCouponDiscountDisplay],
      },
    },
    createdByField,
  ],
  timestamps: true,
}
