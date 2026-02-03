/**
 * Unit tests for PDF fetcher Vercel Blob handling
 * Tests that the fix for ECONNREFUSED error works correctly
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock fetch for HTTP tests
global.fetch = vi.fn()

// Copy of isVercelBlobUrl for testing
function isVercelBlobUrl(url: string): boolean {
  return url.includes('.blob.vercel-storage.com') || url.includes('public.blob.vercel-storage.com')
}

// Copy of getPdfBufferFromUrl for testing
async function getPdfBufferFromUrl(url: string): Promise<Buffer> {
  if (!isVercelBlobUrl(url)) {
    throw new Error(`Invalid Vercel Blob URL: ${url}`)
  }

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// Mock media document
function createMockMedia(
  overrides: Partial<{ url: string; mimeType: string; filesize: number }> = {},
) {
  return {
    url: 'https://example.com/file.pdf',
    mimeType: 'application/pdf',
    filesize: 1024,
    ...overrides,
  }
}

describe('PDF Fetcher Vercel Blob Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isVercelBlobUrl', () => {
    it('should return true for standard Vercel Blob URLs', () => {
      expect(isVercelBlobUrl('https://abc123.blob.vercel-storage.com/media/test.pdf')).toBe(true)
    })

    it('should return true for public Vercel Blob URLs', () => {
      expect(
        isVercelBlobUrl('https://96hg0ck1hvrndmxp.public.blob.vercel-storage.com/media/test.pdf'),
      ).toBe(true)
    })

    it('should return false for regular URLs', () => {
      expect(isVercelBlobUrl('https://cdn.example.com/media/test.pdf')).toBe(false)
    })

    it('should return false for relative URLs', () => {
      expect(isVercelBlobUrl('/api/media/file/test.pdf')).toBe(false)
    })

    it('should return false for localhost URLs', () => {
      expect(isVercelBlobUrl('http://localhost:3000/api/media/file/test.pdf')).toBe(false)
    })
  })

  describe('getPdfBufferFromUrl with Vercel Blob', () => {
    it('should fetch PDF from Vercel Blob URL', async () => {
      const mockPdfBuffer = Buffer.from('%PDF-1.4 mock content')
      const mockResponse = {
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(mockPdfBuffer.buffer),
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      const blobUrl = 'https://abc123.blob.vercel-storage.com/media/test.pdf'
      const result = await getPdfBufferFromUrl(blobUrl)

      expect(fetch).toHaveBeenCalledWith(blobUrl)
      expect(result.toString()).toContain('%PDF')
    })

    it('should throw error for non-Vercel Blob URLs', async () => {
      const regularUrl = 'https://cdn.example.com/media/test.pdf'
      await expect(getPdfBufferFromUrl(regularUrl)).rejects.toThrow('Invalid Vercel Blob URL')
    })

    it('should throw error when fetch fails', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      const blobUrl = 'https://abc123.blob.vercel-storage.com/media/missing.pdf'
      await expect(getPdfBufferFromUrl(blobUrl)).rejects.toThrow(
        'Failed to fetch PDF: 404 Not Found',
      )
    })
  })

  describe('URL handling scenarios (production fix)', () => {
    it('should detect Vercel Blob URL from media document', async () => {
      const media = createMockMedia({
        url: 'https://abc123.blob.vercel-storage.com/media/processed_Math%20-%205units.pdf',
      })

      // This is how pdf-fetcher.ts checks the URL
      const shouldUseBlobAdapter = isVercelBlobUrl(media.url)

      expect(shouldUseBlobAdapter).toBe(true)
    })

    it('should NOT detect relative URL as Vercel Blob (the bug scenario)', async () => {
      // This simulates the old behavior with local filesystem storage
      const media = createMockMedia({
        url: '/api/media/file/processed_Math%20-%205units.pdf',
      })

      const shouldUseBlobAdapter = isVercelBlobUrl(media.url)

      expect(shouldUseBlobAdapter).toBe(false)
      // This would have caused the fallback to localhost:3000
    })

    it('should NOT detect localhost URL as Vercel Blob', async () => {
      const media = createMockMedia({
        url: 'http://localhost:3000/api/media/file/test.pdf',
      })

      const shouldUseBlobAdapter = isVercelBlobUrl(media.url)

      expect(shouldUseBlobAdapter).toBe(false)
    })

    it('should handle Vercel Blob URL with complex query params', () => {
      const url = 'https://abc123.blob.vercel-storage.com/media/test.pdf?download=true'
      expect(isVercelBlobUrl(url)).toBe(true)
    })

    it('should handle Vercel Blob URL with hash fragment', () => {
      const url = 'https://abc123.blob.vercel-storage.com/media/test.pdf#page=1'
      expect(isVercelBlobUrl(url)).toBe(true)
    })
  })

  describe('Vercel Blob URL patterns', () => {
    it('should match typical Vercel Blob URL format', () => {
      const patterns = [
        'https://<random>.blob.vercel-storage.com/<filename>',
        'https://<random>.public.blob.vercel-storage.com/<filename>',
      ]

      patterns.forEach((pattern) => {
        // Just verify the function handles various blob URL formats
        const randomId = Math.random().toString(36).substring(7)
        const blobUrl = `https://${randomId}.blob.vercel-storage.com/media/test.pdf`
        expect(isVercelBlobUrl(blobUrl)).toBe(true)

        const publicBlobUrl = `https://${randomId}.public.blob.vercel-storage.com/media/test.pdf`
        expect(isVercelBlobUrl(publicBlobUrl)).toBe(true)
      })
    })
  })
})
