/**
 * Unit tests for useRemoteStatus hook
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the codyApi
vi.mock('@/ui/cody/api', () => ({
  codyApi: {
    remote: {
      status: vi.fn(),
    },
  },
}))

// Mock react-query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn((options) => {
    // Return the options so we can inspect them
    return { _options: options, data: undefined, isLoading: false }
  }),
}))

import { useQuery } from '@tanstack/react-query'
import { codyApi as _codyApi } from '@/ui/cody/api'

describe('useRemoteStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes correct queryKey with actorLogin', async () => {
    const { useRemoteStatus } = await import('@/ui/cody/hooks/useRemoteStatus')
    useRemoteStatus('alice')

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['remote-status', 'alice'],
      }),
    )
  })

  it('is disabled when actorLogin is not provided', async () => {
    const { useRemoteStatus } = await import('@/ui/cody/hooks/useRemoteStatus')
    useRemoteStatus(null)

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
    )
  })

  it('is enabled when actorLogin is provided', async () => {
    const { useRemoteStatus } = await import('@/ui/cody/hooks/useRemoteStatus')
    useRemoteStatus('alice')

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
      }),
    )
  })

  it('uses 30s refetch interval', async () => {
    const { useRemoteStatus } = await import('@/ui/cody/hooks/useRemoteStatus')
    useRemoteStatus('alice')

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        refetchInterval: 30_000,
      }),
    )
  })
})
