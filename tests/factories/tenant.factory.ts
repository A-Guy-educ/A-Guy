import type { Payload } from 'payload'
import type { Tenant } from '@/payload-types'

export interface TenantFactoryInput {
  name?: string
  slug?: string
}

export function buildTenantData(input: TenantFactoryInput = {}) {
  const timestamp = Date.now()
  return {
    name: input.name ?? `Test Tenant ${timestamp}`,
    slug: input.slug ?? `test-tenant-${timestamp}`,
  }
}

export async function createTestTenant(
  payload: Payload,
  input: TenantFactoryInput = {},
): Promise<Tenant> {
  return payload.create({
    collection: 'tenants',
    data: buildTenantData(input),
    overrideAccess: true,
  })
}
