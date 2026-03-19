import type { Block } from 'payload'

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
      type: 'code',
      required: true,
      admin: {
        language: 'json',
        description:
          'AxisSpecV1 JSON. Must have kind:"cartesian", units, grid, axes, and elements:{points,graphs}.',
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
  ],
}
