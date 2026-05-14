/**
 * ProductItems Collection
 *
 * @fileType collection-config
 * @domain billing
 * @pattern conditional-fields, discriminated-union
 */

import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { anyone } from '../access/anyone'
import { createdByField } from '../fields/createdBy'
import { FEATURE_KEYS, type FeatureKey } from '@/lib/products/feature-keys'

const VALID_FEATURE_KEYS = FEATURE_KEYS

export const ProductItems: CollectionConfig = {
  slug: 'product-items',
  access: {
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
    read: anyone,
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['type', 'lesson', 'featureKey', 'isHighlighted'],
  },
  fields: [
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: '📚 שיעור', value: 'lesson' },
        { label: '⚙️ תכונה', value: 'feature' },
      ],
      admin: {
        description: 'בחר את סוג הפריט: שיעור מהמערכת או תכונה מוגדרת',
        components: {
          Cell: '@/ui/admin/ProductItems/TypeBadgeCell#TypeBadgeCell',
        },
      },
    },
    {
      name: 'lesson',
      type: 'relationship',
      relationTo: 'lessons',
      admin: {
        description: 'בחר את השיעור להוספה למוצר',
        condition: (data) => data.type === 'lesson',
      },
      validate: (value: unknown, { data }: { data: Record<string, unknown> }) => {
        if (data?.type === 'lesson' && !value) return 'Lesson is required when type is lesson'
        return true
      },
    },
    {
      name: 'featureKey',
      type: 'text',
      required: true,
      admin: {
        description: 'מזהה התכונה (לדוגמה: certificate, live-sessions)',
        condition: (data) => data.type === 'feature',
      },
      validate: (value: unknown, { data }: { data: Record<string, unknown> }) => {
        if (data?.type !== 'feature') return true
        if (typeof value !== 'string' || !value)
          return 'Feature key is required when type is feature'
        if (!(VALID_FEATURE_KEYS as readonly string[]).includes(value as FeatureKey)) {
          return `Invalid feature key. Valid values: ${VALID_FEATURE_KEYS.join(', ')}`
        }
        return true
      },
    },
    {
      name: 'isHighlighted',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'סמן אם יש להדגיש פריט זה בממשק המשתמש',
      },
    },
    // Created By
    createdByField,
  ],
}
