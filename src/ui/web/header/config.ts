import type { GlobalConfig } from 'payload'

import { link } from '@/server/payload/fields/link'
import { CONTENT_LOCALES } from '@/server/payload/fields/contentLocale'
import { revalidateHeader } from './hooks/revalidateHeader'

export const Header: GlobalConfig = {
  slug: 'header',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'variants',
      type: 'array',
      label: 'Locale Variants',
      admin: {
        description: 'Navigation items per system language',
        initCollapsed: true,
      },
      fields: [
        {
          name: 'locale',
          type: 'select',
          required: true,
          options: CONTENT_LOCALES.map((l) => ({ label: l.toUpperCase(), value: l })),
          admin: { description: 'System language this variant is for' },
        },
        {
          name: 'navItems',
          type: 'array',
          fields: [
            link({
              appearances: false,
            }),
          ],
          maxRows: 6,
          admin: {
            initCollapsed: true,
            components: {
              RowLabel: '@/ui/admin/Header#RowLabel',
            },
          },
        },
      ],
    },
  ],
  hooks: {
    afterChange: [revalidateHeader],
  },
}
