import type { Payload } from 'payload'

export function getDefaultTenantSlug(): string {
  const slug = process.env.DEFAULT_TENANT_SLUG
  if (!slug) {
    throw new Error('DEFAULT_TENANT_SLUG environment variable is required')
  }

  return slug
}

// Module-level cache — survives across requests within the same serverless instance.
// Cleared when the module is re-evaluated (e.g., on new serverless cold start).
let cachedTenantId: string | null = null

export async function getDefaultTenantId(payload: Payload): Promise<string> {
  // Return cached ID if already resolved for this instance
  if (cachedTenantId) {
    return cachedTenantId
  }

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
