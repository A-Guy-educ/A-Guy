import type { CollectionConfig } from 'payload'
import { adminOnly } from '../access/adminOnly'
import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { createdByField } from '../fields/createdBy'

export const ExerciseAssets: CollectionConfig = {
  slug: 'exercise-assets',
  access: {
    create: authenticated,
    delete: adminOnly,
    read: anyone, // Needs to be public for student rendering
    update: adminOnly,
  },
  upload: {
    // Vercel Blob storage plugin handles actual file storage
    // Plugin injects disableLocalStorage: true and adapter handlers
    // Show thumbnail in admin list view - returns URL or false
    adminThumbnail: ({ doc }) => {
      const docData = doc as { url?: string }
      return docData.url || false
    },
    mimeTypes: ['image/svg+xml', 'image/png'],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description: 'Alt text for accessibility',
      },
    },
    {
      name: 'caption',
      type: 'richText',
      admin: {
        description: 'Optional caption for the figure',
      },
    },

    // Created By
    createdByField,
  ],
}
