import type { Field } from 'payload'

import { getDefaultTenantId } from '@/server/repos/tenant/get-default-tenant'

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

/**
 * Optional tenant field for collections that support cross-tenant (global/legacy) documents.
 * Unlike tenantField, this field:
 * - Is not required
 * - Does not auto-populate on create (documents can remain tenant-less)
 *
 * Use for: Products, Coupons, and other collections where legacy/global documents
 * should remain accessible without a tenant restriction.
 */
export const optionalTenantField: Field = {
  name: 'tenant',
  type: 'relationship',
  relationTo: 'tenants',
  required: false,
  index: true,
  admin: {
    position: 'sidebar',
    description: 'Tenant scope for this document (leave empty for global/legacy products)',
  },
}
