/**
 * Products Collection
 *
 * @fileType collection-config
 * @domain billing
 * @pattern composable-bundle
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { anyone } from '../access/anyone'
import { createdByField } from '../fields/createdBy'
import { formatSlugAsync } from '../fields/formatSlug'

export const Products: CollectionConfig = {
  slug: 'products',
  access: {
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
    read: anyone,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        if (!data) return data

        if (operation === 'update' && originalDoc?.slug) {
          data.slug = data.slug?.trim()
          return data
        }

        if (data.name && !data.slug) {
          const baseSlug = await formatSlugAsync(data.name)
          let slug = baseSlug
          let counter = 1
          const MAX = 100

          for (let attempt = 0; attempt < MAX; attempt++) {
            const existing = await req.payload.find({
              collection: 'products',
              where: { slug: { equals: slug } },
              limit: 1,
              depth: 0,
              req,
            })

            if (existing.docs.length === 0) {
              data.slug = slug
              return data
            }

            slug = `${baseSlug}-${counter}`
            counter++
          }

          data.slug = `${baseSlug}-${Date.now().toString(36)}`
        }

        return data
      },
    ],
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'billingType', 'interval', 'price', 'currency', 'isActive'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Display name for this product',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'URL-friendly identifier (auto-generated from name if empty)',
        position: 'sidebar',
      },
    },
    {
      name: 'billingType',
      type: 'select',
      required: true,
      options: [
        { label: 'One-time', value: 'one_time' },
        { label: 'Subscription', value: 'subscription' },
      ],
      admin: {
        description: 'Type of billing for this product',
      },
    },
    {
      name: 'interval',
      type: 'select',
      options: [
        { label: 'Month', value: 'month' },
        { label: 'Year', value: 'year' },
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
        description: 'Price amount (0 = free)',
      },
    },
    {
      name: 'currency',
      type: 'select',
      required: true,
      defaultValue: 'ILS',
      options: [
        { label: 'ILS (Israeli Shekel)', value: 'ILS' },
        { label: 'USD (US Dollar)', value: 'USD' },
        { label: 'EUR (Euro)', value: 'EUR' },
      ],
      admin: {
        description: 'Currency code',
      },
    },
    {
      name: 'items',
      type: 'relationship',
      relationTo: 'product-items',
      hasMany: true,
      admin: {
        description: 'Lessons and features included in this product',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this product is currently available for purchase',
      },
    },
    // Created By
    createdByField,
  ],
}
