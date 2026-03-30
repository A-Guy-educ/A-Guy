import type { Block } from 'payload'

import { blockSpacingField } from '../../fields/blockSpacing'

export const GraphBlock: Block = {
  slug: 'graphBlock',
  interfaceName: 'GraphBlock',
  labels: {
    plural: 'Graph Blocks',
    singular: 'Graph Block',
  },
  fields: [
    {
      name: 'spec',
      type: 'textarea',
      required: true,
      admin: {
        components: {
          Field: '@/ui/admin/IntroGraphField#IntroGraphSpecField',
        },
      },
    },
    {
      name: 'displaySize',
      type: 'select',
      defaultValue: 'full',
      options: [
        { label: 'Small', value: 'small' },
        { label: 'Medium', value: 'medium' },
        { label: 'Large', value: 'large' },
        { label: 'Full', value: 'full' },
      ],
    },
    blockSpacingField,
  ],
}
