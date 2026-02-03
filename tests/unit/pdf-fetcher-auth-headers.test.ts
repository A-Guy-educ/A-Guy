/**
 * Unit tests for PDF fetcher authentication headers
 * Tests that auth headers are properly passed when fetching from Payload API endpoints
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the dependencies
vi.mock('@/infra/blob/vercel-blob-adapter', () => ({
  getExternalStorageUrl: vi.fn().mockResolvedValue('https://example.com'),
  getPdfBufferFromUrl: vi.fn(),
  isVercelBlobUrl: vi.fn().mockReturnValue(false),
}))

vi.mock('@/infra/utils/http', () => ({
  fetchBuffer: vi.fn(),
}))

import {
  getExternalStorageUrl,
  getPdfBufferFromUrl,
  isVercelBlobUrl,
} from '@/infra/blob/vercel-blob-adapter'
import { fetchBuffer } from '@/infra/utils/http'
import {
  getPdfBufferFromBlob,
  getPdfFileSize,
  normalizeToAbsoluteUrl,
} from '@/server/services/pdf-fetcher'

describe('PDF Fetcher Authentication Headers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createMockMedia = (
    overrides: Partial<{ url: string; mimeType: string; filesize: number }> = {},
  ) => ({
    url: 'https://example.com/api/media/file.pdf',
    mimeType: 'application/pdf',
    filesize: 1024,
    ...overrides,
  })

  const createMockPayload = () => ({
    findByID: vi.fn().mockResolvedValue(createMockMedia()),
  })

  describe('getPdfBufferFromBlob', () => {
    it('should pass auth headers when fetching from Payload API endpoint', async () => {
      const mockPayload = createMockPayload()
      const mockBuffer = Buffer.from('%PDF-1.4 mock content')
      vi.mocked(fetchBuffer).mockResolvedValue(mockBuffer)
      vi.mocked(isVercelBlobUrl).mockReturnValue(false)

      const req = {
        headers: {
          authorization: 'Bearer test-token-123',
          cookie: 'session=abc456',
        },
      }

      await getPdfBufferFromBlob('media-id-123', mockPayload, req)

      expect(fetchBuffer).toHaveBeenCalledWith('https://example.com/api/media/file.pdf', 30000, {
        Authorization: 'Bearer test-token-123',
        Cookie: 'session=abc456',
      })
    })

    it('should pass auth headers with normalized URL', async () => {
      const mockPayload = createMockPayload()
      const mockBuffer = Buffer.from('%PDF-1.4')
      vi.mocked(fetchBuffer).mockResolvedValue(mockBuffer)
      vi.mocked(isVercelBlobUrl).mockReturnValue(false)

      // Media with relative URL should be normalized
      mockPayload.findByID.mockResolvedValueOnce(createMockMedia({ url: '/api/media/file.pdf' }))

      const req = {
        headers: {
          authorization: 'Bearer auth-token',
          cookie: 'cookie-value',
        },
      }

      await getPdfBufferFromBlob('media-id', mockPayload, req)

      expect(getExternalStorageUrl).toHaveBeenCalled()
      expect(fetchBuffer).toHaveBeenCalledWith(
        'https://example.com/api/media/file.pdf',
        30000,
        expect.objectContaining({
          Authorization: 'Bearer auth-token',
        }),
      )
    })

    it('should NOT pass headers for Vercel Blob URLs (public)', async () => {
      const mockPayload = createMockPayload()
      const mockBuffer = Buffer.from('%PDF-1.4')
      vi.mocked(getPdfBufferFromUrl).mockResolvedValue(mockBuffer)

      // Mock the media to have a Vercel Blob URL
      mockPayload.findByID.mockResolvedValueOnce({
        url: 'https://abc123.blob.vercel-storage.com/media/test.pdf',
        mimeType: 'application/pdf',
        filesize: 1024,
      })

      // Mock isVercelBlobUrl to return true for this URL
      vi.mocked(isVercelBlobUrl).mockReturnValue(true)

      const req = {
        headers: {
          authorization: 'Bearer should-not-be-used',
          cookie: 'should-not-be-used',
        },
      }

      const result = await getPdfBufferFromBlob('media-id', mockPayload, req)

      expect(getPdfBufferFromUrl).toHaveBeenCalledWith(
        'https://abc123.blob.vercel-storage.com/media/test.pdf',
      )
      expect(fetchBuffer).not.toHaveBeenCalled()
      expect(result).toBe(mockBuffer)
    })

    it('should handle missing req parameter (backward compatible)', async () => {
      const mockPayload = createMockPayload()
      const mockBuffer = Buffer.from('%PDF-1.4')
      vi.mocked(fetchBuffer).mockResolvedValue(mockBuffer)
      vi.mocked(isVercelBlobUrl).mockReturnValue(false)

      // Call without req - should still work
      await getPdfBufferFromBlob('media-id', mockPayload)

      expect(fetchBuffer).toHaveBeenCalledWith(
        'https://example.com/api/media/file.pdf',
        30000,
        {}, // Empty headers object
      )
    })

    it('should handle partial auth headers', async () => {
      const mockPayload = createMockPayload()
      const mockBuffer = Buffer.from('%PDF-1.4')
      vi.mocked(fetchBuffer).mockResolvedValue(mockBuffer)
      vi.mocked(isVercelBlobUrl).mockReturnValue(false)

      // Only authorization header
      const req = {
        headers: {
          authorization: 'Bearer token-only',
        },
      }

      await getPdfBufferFromBlob('media-id', mockPayload, req)

      expect(fetchBuffer).toHaveBeenCalledWith(expect.any(String), 30000, {
        Authorization: 'Bearer token-only',
      })
      // Cookie should not be included since it wasn't provided
      const callArgs = vi.mocked(fetchBuffer).mock.calls[0]
      expect(callArgs[2]).not.toHaveProperty('Cookie')
    })
  })

  describe('normalizeToAbsoluteUrl', () => {
    it('should return absolute URLs unchanged', async () => {
      const result = await normalizeToAbsoluteUrl('https://cdn.example.com/file.pdf')
      expect(result).toBe('https://cdn.example.com/file.pdf')
    })

    it('should prepend base URL for relative URLs', async () => {
      const result = await normalizeToAbsoluteUrl('/api/media/file.pdf')
      expect(result).toBe('https://example.com/api/media/file.pdf')
    })
  })

  describe('getPdfFileSize', () => {
    it('should return filesize from media document when available', async () => {
      const mockPayload = createMockPayload()
      mockPayload.findByID.mockResolvedValueOnce(createMockMedia({ filesize: 4096 }))

      const size = await getPdfFileSize('media-id', mockPayload)

      expect(size).toBe(4096)
      expect(fetchBuffer).not.toHaveBeenCalled()
    })

    it('should fallback to HEAD request when filesize is missing', async () => {
      const mockPayload = createMockPayload()
      const mockResponse = {
        ok: true,
        headers: new Headers({ 'content-length': '2048' }),
      }

      // Override the fetch mock for this specific test
      const originalFetch = global.fetch
      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      // Media with missing filesize
      mockPayload.findByID.mockResolvedValueOnce(
        createMockMedia({ url: '/api/media/file.pdf', filesize: undefined }),
      )

      const size = await getPdfFileSize('media-id', mockPayload)

      expect(size).toBe(2048)
      expect(global.fetch).toHaveBeenCalled()

      global.fetch = originalFetch
    })
  })
})
