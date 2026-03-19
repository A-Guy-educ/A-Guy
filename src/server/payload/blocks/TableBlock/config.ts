import type { Block } from 'payload'

export const TableBlock: Block = {
  slug: 'tableBlock',
  interfaceName: 'TableBlock',
  labels: {
    plural: 'Table Blocks',
    singular: 'Table Block',
  },
  fields: [
    {
      name: 'headers',
      type: 'code',
      required: true,
      admin: {
        language: 'json',
        description: 'JSON array of header strings, e.g. ["Name", "Value", "Unit"]',
      },
    },
    {
      name: 'rows',
      type: 'code',
      required: true,
      admin: {
        language: 'json',
        description: 'JSON array of row arrays, e.g. [["Mass", "5", "kg"], ["Length", "10", "m"]]',
      },
    },
    {
      name: 'showBorders',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'showHeader',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}
