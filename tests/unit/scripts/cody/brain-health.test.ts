import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('brain-health', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('isBrainAvailable', () => {
    it('returns false when BRAIN_SERVER_URL is undefined', async () => {
      delete process.env.BRAIN_SERVER_URL
      const { isBrainAvailable } = await import('../../../../scripts/cody/brain-health')
      const result = await isBrainAvailable(undefined)
      expect(result).toBe(false)
    })

    it('returns false when BRAIN_SERVER_URL is empty string', async () => {
      process.env.BRAIN_SERVER_URL = ''
      const { isBrainAvailable } = await import('../../../../scripts/cody/brain-health')
      const result = await isBrainAvailable('')
      expect(result).toBe(false)
    })

    it('returns true when server responds with ok status', async () => {
      // Mock fetch to return ok response
      const mockFetch = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', mockFetch)

      const { isBrainAvailable } = await import('../../../../scripts/cody/brain-health')
      const result = await isBrainAvailable('http://100.66.248.120:4097/sse')

      expect(result).toBe(true)
      // Should strip /sse suffix for health check
      expect(mockFetch).toHaveBeenCalledWith(
        'http://100.66.248.120:4097',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
    })

    it('returns false when server times out or errors', async () => {
      // Mock fetch to throw an error
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')))

      const { isBrainAvailable } = await import('../../../../scripts/cody/brain-health')
      const result = await isBrainAvailable('http://100.66.248.120:4097/sse')

      expect(result).toBe(false)
    })

    it('returns false when server returns non-ok status', async () => {
      // Mock fetch to return non-ok response
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))

      const { isBrainAvailable } = await import('../../../../scripts/cody/brain-health')
      const result = await isBrainAvailable('http://100.66.248.120:4097/sse')

      expect(result).toBe(false)
    })

    it('handles URLs without /sse suffix', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', mockFetch)

      const { isBrainAvailable } = await import('../../../../scripts/cody/brain-health')
      const result = await isBrainAvailable('http://100.66.248.120:4097')

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith('http://100.66.248.120:4097', expect.any(Object))
    })
  })
})
