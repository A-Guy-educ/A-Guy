/**
 * Unit tests for HTTP utilities
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchBuffer } from '@/infra/utils/http'

describe('HTTP Utilities', () => {
  describe('fetchBuffer', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('should fetch a buffer from a valid URL', async () => {
      const testData = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x0a]) // %PDF\n
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => testData.buffer,
      }
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response)

      const result = await fetchBuffer('https://example.com/file.pdf')

      expect(result).toBeInstanceOf(Buffer)
      expect(result.toString('ascii')).toBe('%PDF\n')
    })

    it('should throw error on non-ok response', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response)

      await expect(fetchBuffer('https://example.com/notfound.pdf')).rejects.toThrow(
        'HTTP 404 Not Found',
      )
    })

    it('should clear timeout on successful fetch', async () => {
      const testData = new Uint8Array([0x01, 0x02, 0x03])
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => testData.buffer,
      }
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response)

      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

      await fetchBuffer('https://example.com/file.pdf')

      expect(fetchSpy).toHaveBeenCalled()
      expect(clearTimeoutSpy).toHaveBeenCalled()
    })

    it('should clear timeout on fetch error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

      await expect(fetchBuffer('https://example.com/file.pdf')).rejects.toThrow('Network error')

      expect(clearTimeoutSpy).toHaveBeenCalled()
    })

    it('should handle large files', async () => {
      // Create 1MB of test data
      const testData = new Uint8Array(1024 * 1024).fill(0x41) // 'A'
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => testData.buffer,
      }
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response)

      const result = await fetchBuffer('https://example.com/large-file.pdf')

      expect(result.length).toBe(1024 * 1024)
    })

    it('should pass timeout to AbortController', async () => {
      const testData = new Uint8Array([0x01, 0x02, 0x03])
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => testData.buffer,
      }
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response)

      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

      // Use a short timeout for testing
      await fetchBuffer('https://example.com/file.pdf', 500)

      expect(setTimeoutSpy).toHaveBeenCalled()
      expect(clearTimeoutSpy).toHaveBeenCalled()

      // Verify the timeout was set to the expected value
      const timeoutCall = setTimeoutSpy.mock.calls[0]
      expect(timeoutCall[1]).toBe(500)
    })

    it('should pass custom headers to fetch', async () => {
      const testData = new Uint8Array([0x01, 0x02, 0x03])
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => testData.buffer,
      }
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response)

      const customHeaders = {
        Authorization: 'Bearer test-token',
        Cookie: 'session=abc123',
      }

      await fetchBuffer('https://example.com/file.pdf', 30000, customHeaders)

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://example.com/file.pdf',
        expect.objectContaining({
          headers: customHeaders,
        }),
      )
    })

    it('should pass auth headers for protected resources', async () => {
      const testData = new Uint8Array([0x25, 0x50, 0x44, 0x46]) // %PDF
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => testData.buffer,
      }
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response)

      // Simulate auth headers that would be passed from run-immediate route
      const authHeaders = {
        authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        cookie: 'payload-session=xyz789',
      }

      await fetchBuffer('https://api.example.com/protected/file.pdf', 30000, authHeaders)

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.example.com/protected/file.pdf',
        expect.objectContaining({
          headers: {
            authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            cookie: 'payload-session=xyz789',
          },
        }),
      )
    })

    it('should work without headers (backward compatible)', async () => {
      const testData = new Uint8Array([0x01, 0x02, 0x03])
      const mockResponse = {
        ok: true,
        arrayBuffer: async () => testData.buffer,
      }
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response)

      // Call without headers - should still work
      await fetchBuffer('https://example.com/public-file.pdf')

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://example.com/public-file.pdf',
        expect.objectContaining({
          headers: undefined,
        }),
      )
    })
  })
})
