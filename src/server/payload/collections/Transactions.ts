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
import { authenticated } from '../access/authenticated'
import { createdByField } from '../fields/createdBy'
import { tenantField } from '../fields/tenant'

export const Transactions: CollectionConfig = {
  slug: 'transactions',
  access: {
    create: authenticated, // Only authenticated users can create (via API)
    read: adminOnly, // Only admins can read all transactions
    update: adminOnly, // Only admins can update (e.g., mark as succeeded/failed)
    delete: adminOnly, // Only admins can delete
  },
  admin: {
    useAsTitle: 'createdAt',
    defaultColumns: ['createdAt', 'user', 'product', 'amount', 'currency', 'status', 'provider'],
    listSearchableFields: ['providerTransactionId'],
    group: 'Payments',
    components: {
      edit: {
        beforeDocumentControls: ['@/ui/admin/TransactionEditView#TransactionRefundAction'],
      },
    },
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

    createdByField,
  ],
  timestamps: true,
}
