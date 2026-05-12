/**
 * Subscriptions Collection
 *
 * @fileType collection-config
 * @domain payments
 * @ai-summary Tracks subscription lifecycle (active/expired/cancelled/failed)
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { createdByField } from '../fields/createdBy'
import { tenantField } from '../fields/tenant'

export const Subscriptions: CollectionConfig = {
  slug: 'subscriptions',
  admin: {
    defaultColumns: ['user', 'pricingPlan', 'status', 'currentPeriodEnd', 'createdAt'],
    group: 'Payments',
    description: 'Subscription lifecycle records',
  },
  access: {
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
    read: adminOnly,
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
        description: 'Subscriber',
      },
    },
    {
      name: 'pricingPlan',
      type: 'relationship',
      relationTo: 'pricing-plans',
      required: true,
      index: true,
      admin: {
        description: 'Subscription plan',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Expired', value: 'expired' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Failed', value: 'failed' },
      ],
      index: true,
      admin: {
        description: 'Subscription status',
      },
    },
    {
      name: 'currentPeriodStart',
      type: 'date',
      required: true,
      admin: {
        description: 'Start of current billing period',
      },
    },
    {
      name: 'currentPeriodEnd',
      type: 'date',
      required: true,
      index: true,
      admin: {
        description: 'End of current billing period',
      },
    },
    {
      name: 'cancelAtPeriodEnd',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'User chose to cancel; access continues until period end',
      },
    },
    {
      name: 'cancelledAt',
      type: 'date',
      admin: {
        description: 'When the subscription was cancelled',
      },
    },
    {
      name: 'tranzilaSubscriptionId',
      type: 'text',
      admin: {
        description: 'Recurring profile ID from Tranzila',
      },
    },
    createdByField,
  ],
  timestamps: true,
}
