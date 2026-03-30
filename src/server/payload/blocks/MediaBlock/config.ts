import type { Block } from 'payload'

import { blockSpacingField } from '../../fields/blockSpacing'

export const MediaBlock: Block = {
  slug: 'mediaBlock',
  interfaceName: 'MediaBlock',
  fields: [
    {
      name: 'media',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    blockSpacingField,
  ],
}
