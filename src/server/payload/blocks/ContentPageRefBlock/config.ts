import type { Block } from 'payload'

export const ContentPageRefBlock: Block = {
  slug: 'contentPageRef',
  interfaceName: 'ContentPageRefBlock',
  labels: {
    singular: 'Content Page',
    plural: 'Content Pages',
  },
  fields: [
    {
      name: 'contentPage',
      type: 'relationship',
      relationTo: 'content-pages',
      required: true,
      filterOptions: ({ data }) => {
        // Only show content pages that belong to this lesson
        if (data?.id) {
          return {
            lesson: { equals: data.id },
            status: { equals: 'published' },
            isActive: { equals: true },
          }
        }
        return true
      },
      admin: {
        description: 'Reference to a content page belonging to this lesson',
      },
    },
  ],
}
