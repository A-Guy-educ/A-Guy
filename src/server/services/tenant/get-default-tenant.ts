/**
 * Tenant Service
 *
 * @fileType service
 * @domain tenant
 * @ai-summary Service for tenant-related operations
 */

import type { Payload } from 'payload'

export { getDefaultTenantSlug } from '@/server/repos/tenant/get-default-tenant'

// Module-level cache — survives across requests within the same serverless instance.
// Cleared when the module is re-evaluated (e.g., on new serverless cold start).
let cachedTenantId: string | null = null

/**
 * Get the default tenant ID, creating it if it doesn't exist.
 * Uses caching to avoid repeated database queries.
 */
export async function getDefaultTenantId(payload: Payload): Promise<string> {
  // Return cached ID if already resolved for this instance
  if (cachedTenantId) {
    return cachedTenantId
  }

  const { getDefaultTenantSlug } = await import('@/server/repos/tenant/get-default-tenant')
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

    cachedTenantId = created.id
    return created.id
  }

  cachedTenantId = tenant.id
  return tenant.id
}
