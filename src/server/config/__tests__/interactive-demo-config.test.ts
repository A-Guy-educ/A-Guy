// @vitest-environment node
/**
 * Interactive Demo Config Unit Tests
 *
 * @fileType unit-test
 * @domain config
 * @pattern config-normalization
 * @ai-summary Unit tests for interactive demo config boolean normalization
 */

import { ConfigDomain } from '@/infra/config/config-constants'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the config-values module
vi.mock('@/infra/config/runtime/config-values', () => ({
  getConfigDomain: vi.fn(),
}))

describe('getInteractiveDemoConfig', () => {
  let getConfigDomain: ReturnType<typeof vi.fn>
  let getInteractiveDemoConfig: typeof import('@/server/config/interactive-demo-config').getInteractiveDemoConfig

  beforeEach(async () => {
    vi.clearAllMocks()
    // Get the mocked function
    const configModule = await import('@/infra/config/runtime/config-values')
    getConfigDomain = configModule.getConfigDomain as ReturnType<typeof vi.fn>

    // Import the function under test (after mocks are set up)
    const demoConfigModule = await import('@/server/config/interactive-demo-config')
    getInteractiveDemoConfig = demoConfigModule.getInteractiveDemoConfig
  })

  it('should normalize boolean true to true', async () => {
    getConfigDomain.mockResolvedValue({ enabled: true })
    const result = await getInteractiveDemoConfig()
    expect(result.enabled).toBe(true)
  })

  it('should normalize boolean false to false', async () => {
    getConfigDomain.mockResolvedValue({ enabled: false })
    const result = await getInteractiveDemoConfig()
    expect(result.enabled).toBe(false)
  })

  it('should normalize string "true" to true', async () => {
    getConfigDomain.mockResolvedValue({ enabled: 'true' as any })
    const result = await getInteractiveDemoConfig()
    expect(result.enabled).toBe(true)
  })

  it('should normalize string "TRUE" (uppercase) to true', async () => {
    getConfigDomain.mockResolvedValue({ enabled: 'TRUE' as any })
    const result = await getInteractiveDemoConfig()
    expect(result.enabled).toBe(true)
  })

  it('should normalize string "false" to false', async () => {
    getConfigDomain.mockResolvedValue({ enabled: 'false' as any })
    const result = await getInteractiveDemoConfig()
    expect(result.enabled).toBe(false)
  })

  it('should normalize empty object to default (false)', async () => {
    getConfigDomain.mockResolvedValue({})
    const result = await getInteractiveDemoConfig()
    expect(result.enabled).toBe(false)
  })

  it('should normalize null/undefined to default (false)', async () => {
    getConfigDomain.mockResolvedValue({ enabled: null as any })
    const result = await getInteractiveDemoConfig()
    expect(result.enabled).toBe(false)
  })

  it('should return default on error', async () => {
    getConfigDomain.mockRejectedValue(new Error('DB error'))
    const result = await getInteractiveDemoConfig()
    expect(result.enabled).toBe(false)
  })

  it('should pass tenantId to getConfigDomain', async () => {
    const testTenantId = 'test-tenant-123'
    getConfigDomain.mockResolvedValue({ enabled: true })

    await getInteractiveDemoConfig(testTenantId)

    expect(getConfigDomain).toHaveBeenCalledWith(
      ConfigDomain.InteractiveDemo,
      expect.objectContaining({
        tenantId: testTenantId,
        throwIfNotFound: false,
      }),
    )
  })
})
