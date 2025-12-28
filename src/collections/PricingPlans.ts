import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'

export const PricingPlans: CollectionConfig = {
  slug: 'pricing-plans',
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  admin: {
    defaultColumns: [
      'grade',
      'provider',
      'billingType',
      'interval',
      'price',
      'currency',
      'isActive',
      'updatedAt',
    ],
  },
  fields: [
    {
      name: 'grade',
      type: 'relationship',
      relationTo: 'grades',
      required: true,
      index: true,
      admin: {
        description: 'The grade this pricing plan applies to',
      },
    },
    {
      name: 'provider',
      type: 'select',
      required: true,
      options: [
        {
          label: 'PayPal',
          value: 'paypal',
        },
        {
          label: 'Stripe',
          value: 'stripe',
        },
        {
          label: 'Manual',
          value: 'manual',
        },
      ],
      admin: {
        description: 'Payment provider for this plan',
      },
    },
    {
      name: 'providerPlanId',
      type: 'text',
      index: true,
      admin: {
        description: 'Provider-specific plan ID (required for PayPal and Stripe)',
        condition: (data) => data.provider === 'paypal' || data.provider === 'stripe',
      },
      validate: (value: unknown, { data }: { data: Record<string, unknown> }) => {
        if ((data?.provider === 'paypal' || data?.provider === 'stripe') && !value) {
          return 'Provider plan ID is required for PayPal and Stripe'
        }
        return true
      },
    },
    {
      name: 'billingType',
      type: 'select',
      required: true,
      options: [
        {
          label: 'One-time',
          value: 'one_time',
        },
        {
          label: 'Subscription',
          value: 'subscription',
        },
      ],
      admin: {
        description: 'Type of billing',
      },
    },
    {
      name: 'interval',
      type: 'select',
      options: [
        {
          label: 'Month',
          value: 'month',
        },
        {
          label: 'Year',
          value: 'year',
        },
      ],
      admin: {
        description: 'Billing interval (required for subscription billing)',
        condition: (data) => data.billingType === 'subscription',
      },
      validate: (value: unknown, { data }: { data: Record<string, unknown> }) => {
        if (data?.billingType === 'subscription' && !value) {
          return 'Interval is required for subscription billing'
        }
        return true
      },
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Price amount',
      },
    },
    {
      name: 'currency',
      type: 'select',
      required: true,
      options: [
        {
          label: 'ILS (Israeli Shekel)',
          value: 'ILS',
        },
        {
          label: 'USD (US Dollar)',
          value: 'USD',
        },
        {
          label: 'EUR (Euro)',
          value: 'EUR',
        },
      ],
      admin: {
        description: 'Currency code',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this pricing plan is currently active',
      },
    },
  ],
}
