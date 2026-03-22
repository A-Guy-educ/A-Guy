import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('brain-client', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  describe('isBrainHealthy', () => {
    it('returns true when server is reachable', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', mockFetch)

      const { isBrainHealthy } = await import('../../../../scripts/cody/brain-client')
      const result = await isBrainHealthy('http://100.66.248.120:4097/sse')

      expect(result).toBe(true)
    })

    it('returns false when server is not reachable', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')))

      const { isBrainHealthy } = await import('../../../../scripts/cody/brain-client')
      const result = await isBrainHealthy('http://100.66.248.120:4097/sse')

      expect(result).toBe(false)
    })

    it('returns false when URL is empty', async () => {
      const { isBrainHealthy } = await import('../../../../scripts/cody/brain-client')
      const result = await isBrainHealthy('')
      expect(result).toBe(false)
    })

    it('handles URLs without /sse suffix', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', mockFetch)

      const { isBrainHealthy } = await import('../../../../scripts/cody/brain-client')
      const result = await isBrainHealthy('http://100.66.248.120:4097')

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith('http://100.66.248.120:4097', expect.any(Object))
    })
  })
})
