import type { CollectionConfig } from 'payload'
import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { createdByField } from '../fields/createdBy'

export const ExerciseAssets: CollectionConfig = {
  slug: 'exercise-assets',
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone, // Needs to be public for student rendering
    update: authenticated,
  },
  upload: {
    staticDir: 'exercise-assets',
    // Commented out imageSizes to ensure SVGs are not processed/rasterized or broken by sharp.
    // imageSizes: [
    //   {
    //     name: 'thumbnail',
    //     width: 400,
    //     height: 300,
    //     position: 'centre',
    //   },
    //   {
    //     name: 'card',
    //     width: 768,
    //     height: 1024,
    //     position: 'centre',
    //   },
    //   {
    //     name: 'tablet',
    //     width: 1024,
    //     height: undefined,
    //     position: 'centre',
    //   },
    // ],
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
