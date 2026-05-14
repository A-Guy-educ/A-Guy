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
    components: {
      views: {
        edit: {
          Default: {
            Component: '@/ui/admin/Products/EditView#ProductsEditView',
          },
        },
      },
      edit: {
        SaveButton: '@/ui/admin/Products/SaveButton#ProductsSaveButton',
      },
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'שם המוצר (יוצג למשתמשים)',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'מזהה ייחודי (URL-friendly, נוצר אוטומטית מהשם)',
        position: 'sidebar',
      },
    },
    {
      name: 'billingType',
      type: 'select',
      required: true,
      options: [
        { label: 'חד-פעמי', value: 'one_time' },
        { label: 'מנוי', value: 'subscription' },
      ],
      admin: {
        description: 'סוג החיוב: חד-פעמי או מנוי חוזר',
      },
    },
    {
      name: 'interval',
      type: 'select',
      options: [
        { label: 'חודש', value: 'month' },
        { label: 'שנה', value: 'year' },
      ],
      admin: {
        description: 'מרווח החיוב (למנוי בלבד)',
        condition: (data) => data.billingType === 'subscription',
      },
      validate: (value: unknown, { data }: { data: Record<string, unknown> }) => {
        if (data?.billingType === 'subscription' && !value) {
          return 'מרווח החיוב נדרש עבור מנוי'
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
        description: 'מחיר המוצר',
      },
    },
    {
      name: 'currency',
      type: 'select',
      required: true,
      defaultValue: 'ILS',
      options: [
        { label: 'ILS (שקל)', value: 'ILS' },
        { label: 'USD (דולר)', value: 'USD' },
        { label: 'EUR (אירו)', value: 'EUR' },
      ],
      admin: {
        description: 'מטבע התשלום',
      },
    },
    {
      name: 'items',
      type: 'relationship',
      relationTo: 'product-items',
      hasMany: true,
      admin: {
        description: 'בחר את פריטי המוצר (שיעורים ותכונות)',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'האם המוצר פעיל וזמין למכירה',
      },
    },
    // Created By
    createdByField,
  ],
}
