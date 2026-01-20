import type { Field } from 'payload'

import { getDefaultTenantId } from '@/lib/tenant/get-default-tenant'

export const tenantField: Field = {
  name: 'tenant',
  type: 'relationship',
  relationTo: 'tenants',
  required: true,
  index: true,
  admin: {
    position: 'sidebar',
    description: 'Tenant scope for this document',
  },
  hooks: {
    beforeValidate: [
      async ({ value, operation, req }) => {
        if (operation !== 'create' || value) {
          return value
        }

        const tenantId = await getDefaultTenantId(req.payload)
        return tenantId
      },
    ],
  },
}
