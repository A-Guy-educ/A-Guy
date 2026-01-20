import type { Payload } from 'payload'

export function getDefaultTenantSlug(): string {
  const slug = process.env.DEFAULT_TENANT_SLUG
  if (!slug) {
    throw new Error('DEFAULT_TENANT_SLUG environment variable is required')
  }

  return slug
}

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
    throw new Error(`Default tenant with slug "${slug}" not found`)
  }

  return tenant.id
}
