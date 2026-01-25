import type { Payload } from 'payload'
import { getConfigValue } from '@/lib/config/runtime/bootstrap-config'

/**
 * @deprecated Use '@/lib/tenant/get-default-tenant' instead
 */
export function getDefaultTenantSlug(): string {
  return getConfigValue('DEFAULT_TENANT_SLUG')
}

/**
 * @deprecated Use '@/lib/tenant/get-default-tenant' instead
 */
export async function getDefaultTenantId(payload: Payload): Promise<string> {
  const slug = getDefaultTenantSlug()
  const result = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const tenant = result.docs[0]
  if (!tenant) {
    const created = await payload.create({
      collection: 'tenants',
      data: {
        name: slug,
        slug,
        status: 'active',
      },
      overrideAccess: true,
    })

    return created.id
  }

  return tenant.id
}
