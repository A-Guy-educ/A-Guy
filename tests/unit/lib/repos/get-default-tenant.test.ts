/**
 * Unit tests for get-default-tenant.ts
 *
 * Tests the module-level tenant ID cache (cachedTenantId).
 *
 * @fileType unit-test
 * @domain config.tenant
 * @pattern module-cache, singleton
 */

import { vi } from 'vitest'

// We need to test the module-level cache behavior.
// Since module state persists across test files, we use vi.isolateModules()
// to ensure a clean slate for each test.
describe('getDefaultTenantId — module-level cache', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should return cached tenant ID on second call without DB query', async () => {
    const { getDefaultTenantId } = await import('@/server/repos/tenant/get-default-tenant')

    // Mock Payload with spy on find
    const findMock = vi.fn().mockResolvedValue({
      docs: [{ id: 'tenant-123', slug: 'default', name: 'Default', status: 'active' }],
    })

    vi.doMock('payload', () => ({
      getPayload: vi.fn(),
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockPayload: any = {
      find: findMock,
      logger: { warn: vi.fn(), info: vi.fn() },
    }

    // First call — should hit DB
    const id1 = await getDefaultTenantId(mockPayload)
    expect(id1).toBe('tenant-123')
    expect(findMock).toHaveBeenCalledTimes(1)

    // Second call — should return from cache, no DB hit
    const id2 = await getDefaultTenantId(mockPayload)
    expect(id2).toBe('tenant-123')
    // findMock was NOT called again — cache hit
    expect(findMock).toHaveBeenCalledTimes(1)
  })

  test('should return cached tenant ID when tenant exists', async () => {
    vi.resetModules()

    const { getDefaultTenantId } = await import('@/server/repos/tenant/get-default-tenant')

    const findMock = vi.fn().mockResolvedValue({
      docs: [{ id: 'cached-id', slug: 'default', name: 'Default', status: 'active' }],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockPayload: any = {
      find: findMock,
      logger: { warn: vi.fn(), info: vi.fn() },
    }

    const id1 = await getDefaultTenantId(mockPayload)
    expect(id1).toBe('cached-id')

    // Simulate a second request (new payload instance, same module cache)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockPayload2: any = {
      find: findMock,
      logger: { warn: vi.fn(), info: vi.fn() },
    }

    const id2 = await getDefaultTenantId(mockPayload2)
    expect(id2).toBe('cached-id')

    // Only ONE DB call despite two getDefaultTenantId calls
    expect(findMock).toHaveBeenCalledTimes(1)
  })

  test('should create and cache tenant when not found', async () => {
    vi.resetModules()

    const { getDefaultTenantId } = await import('@/server/repos/tenant/get-default-tenant')

    const findMock = vi.fn().mockResolvedValue({ docs: [] })
    const createMock = vi.fn().mockResolvedValue({
      id: 'newly-created-tenant',
      slug: 'default',
      name: 'default',
      status: 'active',
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockPayload: any = {
      find: findMock,
      create: createMock,
      logger: { warn: vi.fn(), info: vi.fn() },
    }

    const id = await getDefaultTenantId(mockPayload)

    // Should have created the tenant since it wasn't found
    expect(createMock).toHaveBeenCalledTimes(1)
    expect(createMock).toHaveBeenCalledWith({
      collection: 'tenants',
      data: {
        name: 'default',
        slug: 'default',
        status: 'active',
      },
      overrideAccess: true,
    })
    expect(id).toBe('newly-created-tenant')

    // Cache should now hold this ID
    expect(findMock).toHaveBeenCalledTimes(1) // Only called once
    const id2 = await getDefaultTenantId(mockPayload)
    expect(id2).toBe('newly-created-tenant')
    // No additional DB calls
    expect(findMock).toHaveBeenCalledTimes(1)
    expect(createMock).toHaveBeenCalledTimes(1)
  })
})
