import type { Block } from 'payload'

export const GeometryBlock: Block = {
  slug: 'geometryBlock',
  interfaceName: 'GeometryBlock',
  labels: {
    plural: 'Geometry Blocks',
    singular: 'Geometry Block',
  },
  fields: [
    {
      name: 'spec',
      type: 'textarea',
      required: true,
      admin: {
        components: {
          Field: '@/ui/admin/IntroGeometryField#IntroGeometrySpecField',
        },
      },
    },
  ],
}
