/**
 * SystemParams Integration Tests
 *
 * @fileType integration-test
 * @domain config.system-params
 * @pattern integration, database
 */

import { ConfigKind } from '@/infra/config/config-constants'
import { clearConfigCache, getSystemParam, loadRuntimeConfig } from '@/infra/config/runtime'
import { SystemParams } from '@/infra/config/system-params'
import config from '@payload-config'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

const TEST_TENANT_SLUG = 'system-params-test-tenant'

describe('SystemParams Integration', () => {
  let payload: Awaited<ReturnType<typeof getPayload>>
  let testTenantId: string

  beforeAll(async () => {
    payload = await getPayload({ config })

    // Get or create test tenant
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: TEST_TENANT_SLUG } },
    })
    if (tenants.docs.length > 0) {
      testTenantId = tenants.docs[0].id
    } else {
      const created = await payload.create({
        collection: 'tenants',
        data: { name: 'System Params Test Tenant', slug: TEST_TENANT_SLUG },
        overrideAccess: true,
      })
      testTenantId = created.id
    }
  })

  afterAll(async () => {
    clearConfigCache()
    // Cleanup test entries
    try {
      await payload.delete({
        collection: 'config_entries',
        where: {
          and: [{ key: { like: 'pdf_conversion_test_' } }, { tenant: { equals: testTenantId } }],
        },
      })
    } catch {
      // Ignore cleanup errors
    }
  })

  test('should load system params with SystemParam kind', async () => {
    // Create a test system param
    await payload.create({
      collection: 'config_entries',
      draft: false,
      data: {
        key: 'pdf_conversion_test_max_pages',
        kind: ConfigKind.SystemParam,
        value: '10',
        enabled: true,
        tenant: testTenantId,
      },
      overrideAccess: true,
    })

    await loadRuntimeConfig(payload, testTenantId)

    // Verify it loads via getSystemParam (since SystemParam is treated like Variable)
    expect(getSystemParam('pdf_conversion_test_max_pages', { tenantId: testTenantId })).toBe('10')
  })

  test('should return defaults when system params not seeded', async () => {
    clearConfigCache()
    await loadRuntimeConfig(payload, testTenantId)

    // These should return defaults since params aren't seeded yet for this tenant
    expect(SystemParams.getPdfConversionMaxSegmentPages(testTenantId)).toBe(2)
    expect(SystemParams.getPdfConversionMaxExercisesPerSegment(testTenantId)).toBe(1000)
    expect(SystemParams.getPdfConversionMaxPromptSizeBytes(testTenantId)).toBe(51200)
  })

  test('should handle SystemParam like Variable (no encryption)', async () => {
    // Create system param
    await payload.create({
      collection: 'config_entries',
      draft: false,
      data: {
        key: 'pdf_conversion_test_exercises',
        kind: ConfigKind.SystemParam,
        value: '2000',
        enabled: true,
        tenant: testTenantId,
      },
      overrideAccess: true,
    })

    await loadRuntimeConfig(payload, testTenantId)

    // Should be accessible via getSystemParam (plaintext)
    expect(getSystemParam('pdf_conversion_test_exercises', { tenantId: testTenantId })).toBe('2000')
  })
})
