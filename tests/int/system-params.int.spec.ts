/**
 * SystemParams Integration Tests
 *
 * @fileType integration-test
 * @domain config.system-params
 * @pattern integration, database, config-values
 */

import { clearConfigValuesCache, loadConfigValues } from '@/infra/config/runtime/config-values'
import { SystemParams } from '@/infra/config/system-params'
import { getDefaultTenantId } from '@/server/repos/tenant/get-default-tenant'
import config from '@payload-config'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

describe('SystemParams Integration (ConfigValues-based)', () => {
  let payload: Awaited<ReturnType<typeof getPayload>>
  let defaultTenantId: string
  let globalConfigId: string

  beforeAll(async () => {
    payload = await getPayload({ config })

    // SystemParams always reads from the default tenant (tenantId param is unused)
    defaultTenantId = await getDefaultTenantId(payload)

    // Clean up any leftover config_values from previous test runs
    try {
      await payload.delete({
        collection: 'config_values',
        where: {
          and: [{ domain: { equals: 'global' } }, { tenant: { equals: defaultTenantId } }],
        },
        overrideAccess: true,
      })
    } catch {
      // Ignore if nothing to delete
    }
    clearConfigValuesCache()
  })

  afterAll(async () => {
    clearConfigValuesCache()
    // Cleanup test entries
    try {
      await payload.delete({
        collection: 'config_values',
        where: {
          and: [{ domain: { equals: 'global' } }, { tenant: { equals: defaultTenantId } }],
        },
        overrideAccess: true,
      })
    } catch {
      // Ignore cleanup errors
    }

    // Close DB connection to prevent connection leaks
    if (payload.db?.destroy) {
      await payload.db.destroy()
    }
  })

  test('should return default values when config not seeded', async () => {
    clearConfigValuesCache()
    await loadConfigValues(payload, defaultTenantId)

    // These should return defaults since params aren't seeded yet
    expect(await SystemParams.getPdfConversionMaxSegmentPages()).toBe(2)
    expect(await SystemParams.getPdfConversionMaxExercisesPerSegment()).toBe(1000)
    expect(await SystemParams.getPdfConversionMaxPromptSizeBytes()).toBe(51200)
  })

  test('should load custom values from config_values', async () => {
    // Clean up any stale entries first (shared CI database)
    try {
      await payload.delete({
        collection: 'config_values',
        where: {
          and: [{ domain: { equals: 'global' } }, { tenant: { equals: defaultTenantId } }],
        },
        overrideAccess: true,
      })
    } catch {
      // Ignore if nothing to delete
    }

    // Create a test config value in the global domain for default tenant
    const created = await payload.create({
      collection: 'config_values',
      draft: false,
      data: {
        domain: 'global',
        config: {
          pdf_conversion_max_segment_pages: 10,
          pdf_conversion_max_exercises_per_segment: 500,
          pdf_conversion_max_prompt_size_bytes: 102400,
        },
        tenant: defaultTenantId,
      },
      overrideAccess: true,
    })

    // Clear cache to force reload with new values
    clearConfigValuesCache()
    await loadConfigValues(payload, defaultTenantId)

    // Verify it loads via SystemParams
    expect(await SystemParams.getPdfConversionMaxSegmentPages()).toBe(10)

    // Store ID for update in next test
    globalConfigId = created.id
  })

  test('should override tenant-specific values', async () => {
    // Skip if previous test didn't set globalConfigId
    if (!globalConfigId) {
      throw new Error('globalConfigId not set — previous test must have failed')
    }

    // Update the existing global config entry
    await payload.update({
      collection: 'config_values',
      id: globalConfigId,
      data: {
        config: {
          pdf_conversion_max_exercises_per_segment: 750,
        },
      },
      overrideAccess: true,
    })

    // Clear cache to force reload with updated values
    clearConfigValuesCache()
    await loadConfigValues(payload, defaultTenantId)

    // Should use updated value
    expect(await SystemParams.getPdfConversionMaxExercisesPerSegment()).toBe(750)
  })
})
