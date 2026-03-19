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
      type: 'textarea',
      required: true,
      admin: {
        components: {
          Field: '@/ui/admin/IntroTableField#IntroTableHeadersField',
        },
      },
    },
    {
      name: 'rows',
      type: 'textarea',
      required: true,
      admin: {
        components: {
          Field: '@/ui/admin/IntroTableField#IntroTableRowsField',
        },
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
