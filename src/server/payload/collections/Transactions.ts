/**
 * Transactions Collection
 *
 * @fileType collection-config
 * @domain payments
 * @pattern transaction-log
 * @ai-summary Records payment transactions initiated via checkout API
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { createdByField } from '../fields/createdBy'
import { tenantField } from '../fields/tenant'
import { statusTransitionGuard } from './Transactions/hooks/statusTransitionGuard-hook'
import { syncPaymentStats } from './Transactions/hooks/syncPaymentStats-hook'

export const Transactions: CollectionConfig = {
  slug: 'transactions',
  access: {
    create: () => false, // Only created via webhooks/checkout with overrideAccess: true
    read: adminOnly, // Only admins can read all transactions
    update: adminOnly, // Only admins can update (e.g., mark as succeeded/failed)
    delete: adminOnly, // Only admins can delete
  },
  admin: {
    description:
      'Transactions are auto-created by payment webhooks and the checkout route. Manual creation is disabled — dangling records break revenue stats, refunds, and the purchases page.',
    useAsTitle: 'createdAt',
    defaultColumns: ['createdAt', 'user', 'product', 'amount', 'currency', 'status', 'provider'],
    listSearchableFields: ['providerTransactionId'],
    group: 'Payments',
    components: {
      edit: {
        beforeDocumentControls: [
          '@/ui/admin/TransactionEditView#TransactionRefundAction',
          '@/ui/admin/TransactionEditView#TransactionPaymentDetail',
        ],
      },
    },
  },
  hooks: {
    beforeChange: [statusTransitionGuard],
    afterChange: [syncPaymentStats],
  },
  fields: [
    tenantField,

    // User who initiated the transaction
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        description: 'User who initiated the payment',
      },
    },

    // Product being purchased
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      index: true,
      admin: {
        description: 'Product being purchased',
      },
    },

    // Payment provider
    {
      name: 'provider',
      type: 'select',
      required: true,
      options: [
        { label: 'Stripe', value: 'stripe' },
        { label: 'PayPal', value: 'paypal' },
      ],
      index: true,
      admin: {
        description: 'Payment provider used for this transaction',
      },
    },

    // Provider's transaction ID (Stripe session ID or PayPal order ID)
    {
      name: 'providerTransactionId',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Transaction ID from the payment provider',
      },
    },

    // Stripe PaymentIntent ID (pi_... / ch_...) — used for refunds and charge.refunded lookup.
    // For Stripe, this is distinct from providerTransactionId (which is the Checkout Session ID, cs_...).
    // Populated when checkout.session.completed fires with payment_status=paid, or when
    // async_payment_succeeded fires. Used instead of providerTransactionId when calling stripe.refunds.create.
    {
      name: 'paymentIntentId',
      type: 'text',
      admin: {
        description: 'Stripe PaymentIntent ID (pi_...) — used for refunds and webhook lookup',
      },
    },

    // PayPal Capture ID — required for PayPal refund and PAYMENT.CAPTURE.REFUNDED lookup.
    // For PayPal, providerTransactionId stores the Order ID, but the refund endpoint and
    // PAYMENT.CAPTURE.REFUNDED event key on the Capture ID (event.resource.id).
    // Populated when PAYMENT.CAPTURE.COMPLETED fires.
    {
      name: 'captureId',
      type: 'text',
      admin: {
        description: 'PayPal Capture ID — used for refunds and refund webhook lookup',
      },
    },

    // Transaction status
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Succeeded', value: 'succeeded' },
        { label: 'Failed', value: 'failed' },
        { label: 'Refunded', value: 'refunded' },
      ],
      index: true,
      admin: {
        description: 'Current status of the transaction',
        components: {
          Cell: '@/ui/admin/TransactionStatusCell#TransactionStatusCell',
        },
      },
    },

    // Amount in agorot (cents) - smallest currency unit
    {
      name: 'amount',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Amount in agorot (1 ILS = 100 agorot)',
      },
    },

    // Currency code
    {
      name: 'currency',
      type: 'text',
      required: true,
      defaultValue: 'ILS',
      admin: {
        description: 'Currency code (e.g., ILS, USD, EUR)',
      },
    },

    // Additional metadata from payment provider
    {
      name: 'metadata',
      type: 'json',
      admin: {
        description: 'Additional metadata (item IDs, lesson IDs, etc.)',
      },
    },

    // Checkout URLs for reference
    {
      name: 'successUrl',
      type: 'text',
      admin: {
        description: 'Original success redirect URL',
      },
    },
    {
      name: 'cancelUrl',
      type: 'text',
      admin: {
        description: 'Original cancel redirect URL',
      },
    },

    // Provider error message if applicable
    {
      name: 'errorMessage',
      type: 'text',
      admin: {
        description: 'Error message if transaction failed',
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

    // Timestamp when coupon was consumed on this transaction (set by webhook handlers).
    // Used for idempotency — replayed webhooks skip re-consumption if set.
    // Independent from entitlementsGrantedAt so retry-safe: if coupon consumption fails
    // on first delivery (returns 500), retry will still attempt consumption.
    {
      name: 'couponConsumedAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'Timestamp when coupon was consumed on this transaction',
      },
      index: true,
    },

    // Timestamp when purchase receipt email was sent.
    // Used for idempotency — replayed webhooks skip re-sending if set.
    // Set by the purchase receipt email handler after successful send.
    {
      name: 'emailSentAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'Timestamp when the purchase receipt email was sent to the user',
      },
      index: true,
    },

    // Refund audit fields (set when transaction is refunded)
    {
      name: 'refundedAmount',
      type: 'number',
      admin: {
        description: 'Amount refunded in agorot (smallest currency unit)',
        readOnly: true,
      },
    },
    {
      name: 'refundedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Admin who processed the refund',
        readOnly: true,
      },
    },
    {
      name: 'refundedAt',
      type: 'date',
      admin: {
        description: 'When the refund was processed',
        readOnly: true,
      },
    },

    createdByField,
  ],
  timestamps: true,
}
