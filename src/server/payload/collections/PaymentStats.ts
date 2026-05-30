/**
 * PaymentStats Collection
 *
 * Stores daily aggregated payment KPIs per currency: revenue, refunds,
 * failures, and transaction counts.
 *
 * @fileType collection-config
 * @domain payments
 * @pattern transaction-log
 * @ai-summary Daily payment aggregations for admin analytics
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'

export const PaymentStats: CollectionConfig = {
  slug: 'payment_stats',
  access: {
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  admin: {
    group: 'Payments',
    defaultColumns: [
      'date',
      'currency',
      'totalRevenueAgorot',
      'transactionCount',
      'succeededCount',
      'refundedCount',
    ],
  },
  // Unique compound index prevents duplicate rows for the same (date, currency).
  // Combined with the atomic upsert in syncPaymentStats-hook.ts, this guarantees
  // no race conditions and no duplicate rows even if other code paths bypass the hook.
  indexes: [
    {
      fields: ['date', 'currency'],
      unique: true,
    },
  ],
  fields: [
    // Calendar date for this row (YYYY-MM-DD in UTC). Stored as text to
    // avoid timezone issues; formatted as YYYY-MM-DD from the transaction's
    // createdAt timestamp using .toISOString().split('T')[0].
    {
      name: 'date',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Calendar date in YYYY-MM-DD format (UTC)',
      },
    },
    {
      name: 'currency',
      type: 'select',
      required: true,
      options: [
        { label: 'ILS', value: 'ILS' },
        { label: 'USD', value: 'USD' },
        { label: 'EUR', value: 'EUR' },
      ],
      index: true,
      admin: {
        description: 'Currency for all amounts on this date',
      },
    },
    {
      name: 'totalRevenueAgorot',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Sum of succeeded transaction amounts in agorot',
      },
    },
    {
      name: 'refundedAgorot',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Sum of refunded amounts in agorot',
      },
    },
    {
      name: 'failedAgorot',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Sum of failed amounts in agorot',
      },
    },
    {
      name: 'transactionCount',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Total number of transactions on this date (all statuses)',
      },
    },
    {
      name: 'succeededCount',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'refundedCount',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'failedCount',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'newCustomersCount',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        description:
          'Approximate count of newly-counted succeeded transactions per day — may overcount repeat users on the same date due to simplified deduplication logic',
      },
    },
  ],
  timestamps: true,
}
