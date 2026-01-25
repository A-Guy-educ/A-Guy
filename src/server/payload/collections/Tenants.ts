import type { CollectionConfig } from 'payload'

import { getConfigValue } from '@/lib/config/runtime/bootstrap-config'
import { adminOnly } from '@/server/payload/access/adminOnly'

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'status', 'updatedAt'],
  },
  access: {
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Tenant display name',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Tenant slug (used to resolve default tenant from env)',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: {
        description: 'Tenant status flag',
      },
    },
  ],
  hooks: {
    beforeDelete: [
      async ({ req, id }) => {
        const defaultTenantSlug = getConfigValue('DEFAULT_TENANT_SLUG')

        const tenant = await req.payload.findByID({
          collection: 'tenants',
          id,
          req,
          overrideAccess: true,
        })

        if (tenant?.slug === defaultTenantSlug) {
          throw new Error('Default tenant cannot be deleted')
        }
      },
    ],
  },
  timestamps: true,
}
