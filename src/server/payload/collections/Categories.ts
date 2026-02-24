import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { adminOnly } from '../access/adminOnly'
import { slugField } from 'payload'
import { createdByField } from '../fields/createdBy'

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
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    slugField({
      position: undefined,
    }),

    // Created By
    createdByField,
  ],
}
