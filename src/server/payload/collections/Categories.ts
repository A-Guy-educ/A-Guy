import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { adminOnly } from '../access/adminOnly'
import { slugField } from 'payload'
import { createdByField } from '../fields/createdBy'
import { contentLocaleField } from '../fields/contentLocale'
import { enforceSlugLocaleUniqueness } from '../hooks/validateLocaleUniqueness'

export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: anyone,
    update: adminOnly,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'locale', 'slug', 'updatedAt'],
  },
  hooks: {
    beforeChange: [enforceSlugLocaleUniqueness('categories')],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    // Content locale
    contentLocaleField,
    slugField({
      position: undefined,
    }),

    // Created By
    createdByField,
  ],
}
