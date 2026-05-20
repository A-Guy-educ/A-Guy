/**
 * Transactions Collection
 *
 * @fileType collection-config
 * @domain payments
 * @ai-summary Records every payment transaction from Tranzila gateway
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { createdByField } from '../fields/createdBy'
import { tenantField } from '../fields/tenant'
import { statusTransitionGuard } from './Transactions/hooks/statusTransitionGuard-hook'
import { syncPaymentStats } from './Transactions/hooks/syncPaymentStats-hook'

export const Transactions: CollectionConfig = {
  slug: 'transactions',
  admin: {
    defaultColumns: ['user', 'pricingPlan', 'amount', 'currency', 'status', 'createdAt'],
    group: 'Payments',
    description: 'Payment transaction records',
  },
  access: {
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
    read: adminOnly,
  },
  hooks: {
    beforeChange: [statusTransitionGuard],
    afterChange: [syncPaymentStats],
  },
  fields: [
    tenantField,
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        description: 'User who made the payment',
      },
    },
    {
      name: 'pricingPlan',
      type: 'relationship',
      relationTo: 'pricing-plans',
      required: true,
      index: true,
      admin: {
        description: 'Pricing plan purchased',
      },
    },
    {
      name: 'tranzilaTransactionId',
      type: 'text',
      index: true,
      admin: {
        description: "Tranzila's TXnID",
      },
    },
    {
      name: 'tranzilaOrderId',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: "Tranzila's order reference",
      },
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      admin: {
        description: 'Payment amount',
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
      admin: {
        description: 'Currency code',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Completed', value: 'completed' },
        { label: 'Failed', value: 'failed' },
        { label: 'Refunded', value: 'refunded' },
      ],
      index: true,
      admin: {
        description: 'Transaction status',
      },
    },
    {
      name: 'paymentMethod',
      type: 'select',
      options: [
        { label: 'Credit Card', value: 'credit_card' },
        { label: 'Apple Pay', value: 'apple_pay' },
        { label: 'Other', value: 'other' },
      ],
      admin: {
        description: 'Payment method used',
      },
    },
    {
      name: 'tranzilaResponse',
      type: 'json',
      admin: {
        description: 'Raw Tranzila callback data',
        hidden: true,
      },
    },
    {
      name: 'failureReason',
      type: 'text',
      admin: {
        description: 'Reason for failure (if applicable)',
      },
    },
    {
      name: 'refundedAt',
      type: 'date',
      admin: {
        description: 'When the refund was processed',
      },
    },

    // Timestamp when entitlements were granted (set by webhook handlers on successful grant).
    // Used for observability and idempotency — replayed webhooks skip re-grant if set.
    {
      name: 'entitlementsGrantedAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'Timestamp when product entitlements were granted to the user',
      },
    },

    // Refund audit fields (set when transaction is refunded)
    {
      name: 'refundedAmount',
      type: 'number',
      admin: {
        description: 'Amount refunded',
      },
    },
    {
      name: 'refundedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Admin who processed the refund',
      },
    },
    createdByField,
  ],
  timestamps: true,
}
