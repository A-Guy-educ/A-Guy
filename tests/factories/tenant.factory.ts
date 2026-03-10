import type { Payload } from 'payload'
import type { Tenant } from '@/payload-types'
import type { TestDataTracker } from '../helpers/test-data-tracker'

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
  tracker?: TestDataTracker,
): Promise<Tenant> {
  const tenant = await payload.create({
    collection: 'tenants',
    data: buildTenantData(input),
    overrideAccess: true,
  })
  tracker?.track('tenants', tenant.id)
  return tenant
}
