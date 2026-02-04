/**
 * SystemParams Integration Tests
 *
 * @fileType integration-test
 * @domain config.system-params
 * @pattern integration, database, config-values
 */

import { clearConfigValuesCache, loadConfigValues } from '@/infra/config/runtime/config-values'
import { SystemParams } from '@/infra/config/system-params'
import config from '@payload-config'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

const TEST_TENANT_SLUG = 'system-params-test-tenant'

describe('SystemParams Integration (ConfigValues-based)', () => {
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
    clearConfigValuesCache()
    // Cleanup test entries
    try {
      await payload.delete({
        collection: 'config_values',
        where: {
          and: [{ domain: { equals: 'global' } }, { tenant: { equals: testTenantId } }],
        },
      })
    } catch {
      // Ignore cleanup errors
    }
  })

  test('should return default values when config not seeded', async () => {
    clearConfigValuesCache()
    await loadConfigValues(payload, testTenantId)

    // These should return defaults since params aren't seeded yet for this tenant
    expect(await SystemParams.getPdfConversionMaxSegmentPages(testTenantId)).toBe(2)
    expect(await SystemParams.getPdfConversionMaxExercisesPerSegment(testTenantId)).toBe(1000)
    expect(await SystemParams.getPdfConversionMaxPromptSizeBytes(testTenantId)).toBe(51200)
  })

  test('should load custom values from config_values', async () => {
    // Create a test config value in the global domain
    await payload.create({
      collection: 'config_values',
      draft: false,
      data: {
        domain: 'global',
        config: { maxPages: 10, maxExercisesPerSegment: 500, maxPromptSizeBytes: 102400 },
        tenant: testTenantId,
      },
      overrideAccess: true,
    })

    await loadConfigValues(payload, testTenantId)

    // Verify it loads via SystemParams
    expect(await SystemParams.getPdfConversionMaxSegmentPages(testTenantId)).toBe(10)
  })

  test('should override tenant-specific values', async () => {
    // Create tenant-specific config value
    await payload.create({
      collection: 'config_values',
      draft: false,
      data: {
        domain: 'global',
        config: { maxExercisesPerSegment: 750 },
        tenant: testTenantId,
      },
      overrideAccess: true,
    })

    await loadConfigValues(payload, testTenantId)

    // Should use tenant-specific value
    expect(await SystemParams.getPdfConversionMaxExercisesPerSegment(testTenantId)).toBe(750)
  })
})
