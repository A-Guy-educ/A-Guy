/**
 * WebhookEvents Collection
 *
 * Central deduplication log for Stripe and PayPal webhook events.
 * Keyed on (provider, eventId) — a compound unique index prevents double-processing.
 *
 * Flow:
 * 1. Webhook arrives → attempt create WebhookEvents doc (provider, eventId, eventType, receivedAt, processed: false)
 * 2. Duplicate-key error → return 200 { received: true, deduped: true } immediately (already processed)
 * 3. Success → continue normal processing
 * 4. After success → update processed: true on the same doc
 *
 * Edge case: if processing throws after step 2 succeeds, processed stays false so a manual
 * replay tool can re-run it; the provider will also retry and hit the dedup gate.
 *
 * @fileType collection-config
 * @domain payments
 * @pattern webhook-dedup
 * @ai-summary Central event log for webhook deduplication across payment providers
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'

export const WebhookEvents: CollectionConfig = {
  slug: 'webhook-events',
  access: {
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'eventId',
    defaultColumns: ['provider', 'eventId', 'eventType', 'receivedAt', 'processed'],
    group: 'Payments',
  },
  indexes: [
    {
      fields: ['provider', 'eventId'],
      unique: true,
    },
  ],
  fields: [
    // Payment provider ('stripe' | 'paypal')
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
        description: 'Payment provider that sent this webhook event',
      },
    },

    // Provider's event ID — used for deduplication
    {
      name: 'eventId',
      type: 'text',
      required: true,
      admin: {
        description: 'Provider-assigned event ID used for deduplication',
      },
    },

    // Event type from the provider (e.g., 'checkout.session.completed', 'PAYMENT.CAPTURE.COMPLETED')
    {
      name: 'eventType',
      type: 'text',
      required: true,
      admin: {
        description: 'Type of webhook event',
      },
    },

    // When the event was first received
    {
      name: 'receivedAt',
      type: 'date',
      required: true,
      defaultValue: () => new Date(),
      admin: {
        description: 'Timestamp when this event was first received',
      },
    },

    // Whether processing completed successfully
    {
      name: 'processed',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether this event was successfully processed',
      },
    },
  ],
  timestamps: true,
}
