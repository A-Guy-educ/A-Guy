/**
 * Default Tenant Utilities
 * Provides tenant-scoped operations for the lib layer
 *
 * @internal This module is used by infra layer services
 */
import type { Payload } from 'payload'
import { getConfigValue } from '@/lib/config/runtime/bootstrap-config'

/**
 * Get the default tenant slug from environment
 * This is a bootstrap config value (not a secret)
 */
export function getDefaultTenantSlug(): string {
  return getConfigValue('DEFAULT_TENANT_SLUG')
}

/**
 * Get the default tenant ID by looking up the tenant by slug
 * Creates the tenant if it doesn't exist
 *
 * @param payload - Payload instance for database access
 * @returns The default tenant ID
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
