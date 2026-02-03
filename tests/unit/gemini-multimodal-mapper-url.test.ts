/**
 * Unit tests for Gemini Multimodal Mapper URL handling
 * Tests the fix for ECONNREFUSED errors when media URLs are local/relative
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- Tests intentionally use any for mocking */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock dependencies before imports
vi.mock('@/infra/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockRejectedValue(new Error('ENOENT: file not found')),
}))

vi.mock('@/infra/blob/vercel-blob-adapter', () => ({
  isVercelBlobUrl: vi.fn(),
}))

vi.mock('@/server/services/pdf-fetcher', () => ({
  normalizeToAbsoluteUrl: vi.fn(),
}))

vi.mock('@/infra/llm/providers/gemini/gemini.client', () => ({
  getGeminiClient: vi.fn(),
}))

describe('Gemini Multimodal Mapper URL Handling', () => {
  let mockFetch: any

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset and setup global fetch mock
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    })
    global.fetch = mockFetch
  })

  describe('convertMediaToGeminiPart URL normalization', () => {
    it('should use URL directly for Vercel Blob URLs (no normalization needed)', async () => {
      const { mapMultimodalToGemini } =
        await import('@/infra/llm/providers/gemini/multimodal-mapper')
      const { isVercelBlobUrl } = await import('@/infra/blob/vercel-blob-adapter')
      const { normalizeToAbsoluteUrl } = await import('@/server/services/pdf-fetcher')
      const { getGeminiClient } = await import('@/infra/llm/providers/gemini/gemini.client')

      // Setup: Vercel Blob URL detected
      ;(isVercelBlobUrl as any).mockReturnValue(true)
      ;(normalizeToAbsoluteUrl as any).mockResolvedValue(
        'https://normalized.example.com/media/file.pdf',
      )

      // Mock Gemini client
      const mockModel = {
        generateContent: vi.fn().mockResolvedValue({
          response: { text: () => 'result' },
        }),
      }
      const mockClient = { getGenerativeModel: vi.fn().mockReturnValue(mockModel) }
      ;(getGeminiClient as any).mockResolvedValue(mockClient)

      // Mock payload findByID
      const mockPayload = {
        findByID: vi.fn().mockResolvedValue({
          url: 'https://example.blob.vercel-storage.com/media/test.pdf',
        }),
      } as any

      const mediaPart = {
        mediaId: 'test-id',
        type: 'pdf' as const,
        absoluteFilePath: '/nonexistent/file.pdf',
        publicUrl: 'https://example.blob.vercel-storage.com/media/test.pdf',
        mimeType: 'application/pdf',
      }

      const result = await mapMultimodalToGemini([mediaPart], mockPayload)

      // Verify isVercelBlobUrl was called
      expect(isVercelBlobUrl).toHaveBeenCalledWith(
        'https://example.blob.vercel-storage.com/media/test.pdf',
      )

      // Verify normalizeToAbsoluteUrl was NOT called for Blob URLs
      expect(normalizeToAbsoluteUrl).not.toHaveBeenCalled()

      // Verify fetch was called with the original Blob URL
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.blob.vercel-storage.com/media/test.pdf',
        expect.any(Object),
      )

      expect(result.currentMessage).toHaveLength(1)
    })

    it('should normalize local/relative URLs before fetching', async () => {
      const { mapMultimodalToGemini } =
        await import('@/infra/llm/providers/gemini/multimodal-mapper')
      const { isVercelBlobUrl } = await import('@/infra/blob/vercel-blob-adapter')
      const { normalizeToAbsoluteUrl } = await import('@/server/services/pdf-fetcher')
      const { getGeminiClient } = await import('@/infra/llm/providers/gemini/gemini.client')

      // Setup: NOT a Vercel Blob URL - should be normalized
      ;(isVercelBlobUrl as any).mockReturnValue(false)
      ;(normalizeToAbsoluteUrl as any).mockResolvedValue('https://cdn.example.com/media/test.pdf')

      // Mock Gemini client
      const mockModel = {
        generateContent: vi.fn().mockResolvedValue({
          response: { text: () => 'result' },
        }),
      }
      const mockClient = { getGenerativeModel: vi.fn().mockReturnValue(mockModel) }
      ;(getGeminiClient as any).mockResolvedValue(mockClient)

      // Mock payload findByID
      const mockPayload = {
        findByID: vi.fn().mockResolvedValue({
          url: '/api/media/test.pdf', // Local/relative URL
        }),
      } as any

      const mediaPart = {
        mediaId: 'test-id',
        type: 'pdf' as const,
        absoluteFilePath: '/nonexistent/file.pdf',
        publicUrl: '/api/media/test.pdf',
        mimeType: 'application/pdf',
      }

      const result = await mapMultimodalToGemini([mediaPart], mockPayload)

      // Verify isVercelBlobUrl was called with the media URL
      expect(isVercelBlobUrl).toHaveBeenCalledWith('/api/media/test.pdf')

      // Verify normalizeToAbsoluteUrl was called for non-Blob URLs
      expect(normalizeToAbsoluteUrl).toHaveBeenCalledWith('/api/media/test.pdf')

      // Verify fetch was called with the NORMALIZED URL
      expect(mockFetch).toHaveBeenCalledWith(
        'https://cdn.example.com/media/test.pdf',
        expect.any(Object),
      )

      expect(result.currentMessage).toHaveLength(1)
    })

    it('should handle localhost URLs by normalizing them', async () => {
      const { mapMultimodalToGemini } =
        await import('@/infra/llm/providers/gemini/multimodal-mapper')
      const { isVercelBlobUrl } = await import('@/infra/blob/vercel-blob-adapter')
      const { normalizeToAbsoluteUrl } = await import('@/server/services/pdf-fetcher')
      const { getGeminiClient } = await import('@/infra/llm/providers/gemini/gemini.client')

      // Setup: localhost URL - NOT a Blob URL
      ;(isVercelBlobUrl as any).mockReturnValue(false)
      ;(normalizeToAbsoluteUrl as any).mockResolvedValue('https://cdn.example.com/media/test.pdf')

      // Mock Gemini client
      const mockModel = {
        generateContent: vi.fn().mockResolvedValue({
          response: { text: () => 'result' },
        }),
      }
      const mockClient = { getGenerativeModel: vi.fn().mockReturnValue(mockModel) }
      ;(getGeminiClient as any).mockResolvedValue(mockClient)

      // Mock payload findByID with localhost URL (the error case)
      const mockPayload = {
        findByID: vi.fn().mockResolvedValue({
          url: 'http://127.0.0.1:3000/media/test.pdf', // This caused ECONNREFUSED
        }),
      } as any

      const mediaPart = {
        mediaId: 'test-id',
        type: 'pdf' as const,
        absoluteFilePath: '/nonexistent/file.pdf',
        publicUrl: 'http://127.0.0.1:3000/media/test.pdf',
        mimeType: 'application/pdf',
      }

      const result = await mapMultimodalToGemini([mediaPart], mockPayload)

      // Verify the flow that fixes the ECONNREFUSED error
      expect(isVercelBlobUrl).toHaveBeenCalledWith('http://127.0.0.1:3000/media/test.pdf')
      expect(normalizeToAbsoluteUrl).toHaveBeenCalledWith('http://127.0.0.1:3000/media/test.pdf')

      // Verify fetch was called with the normalized URL, NOT the localhost URL
      expect(mockFetch).toHaveBeenCalledWith(
        'https://cdn.example.com/media/test.pdf',
        expect.any(Object),
      )

      expect(result.currentMessage).toHaveLength(1)
    })

    it('should preserve authentication headers during fetch', async () => {
      const { mapMultimodalToGemini } =
        await import('@/infra/llm/providers/gemini/multimodal-mapper')
      const { isVercelBlobUrl } = await import('@/infra/blob/vercel-blob-adapter')
      const { getGeminiClient } = await import('@/infra/llm/providers/gemini/gemini.client')

      // Mock Gemini client
      const mockModel = {
        generateContent: vi.fn().mockResolvedValue({
          response: { text: () => 'result' },
        }),
      }
      const mockClient = { getGenerativeModel: vi.fn().mockReturnValue(mockModel) }
      ;(getGeminiClient as any).mockResolvedValue(mockClient)
      ;(isVercelBlobUrl as any).mockReturnValue(true)

      // Mock payload findByID
      const mockPayload = {
        findByID: vi.fn().mockResolvedValue({
          url: 'https://example.blob.vercel-storage.com/media/test.pdf',
        }),
      } as any

      const mediaPart = {
        mediaId: 'test-id',
        type: 'pdf' as const,
        absoluteFilePath: '/nonexistent/file.pdf',
        publicUrl: 'https://example.blob.vercel-storage.com/media/test.pdf',
        mimeType: 'application/pdf',
      }

      const req = {
        headers: {
          authorization: 'Bearer test-token',
          cookie: 'session=abc123',
        },
      }

      await mapMultimodalToGemini([mediaPart], mockPayload, req)

      // Verify authentication headers were passed
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.blob.vercel-storage.com/media/test.pdf',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            Cookie: 'session=abc123',
          }),
        }),
      )
    })

    it('should return null when fetch fails', async () => {
      const { mapMultimodalToGemini } =
        await import('@/infra/llm/providers/gemini/multimodal-mapper')
      const { isVercelBlobUrl } = await import('@/infra/blob/vercel-blob-adapter')
      const { getGeminiClient } = await import('@/infra/llm/providers/gemini/gemini.client')
      const { logger } = await import('@/infra/utils/logger')

      // Mock fetch to fail
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      // Mock Gemini client
      const mockModel = {
        generateContent: vi.fn().mockResolvedValue({
          response: { text: () => 'result' },
        }),
      }
      const mockClient = { getGenerativeModel: vi.fn().mockReturnValue(mockModel) }
      ;(getGeminiClient as any).mockResolvedValue(mockClient)
      ;(isVercelBlobUrl as any).mockReturnValue(true)

      // Mock payload findByID
      const mockPayload = {
        findByID: vi.fn().mockResolvedValue({
          url: 'https://example.blob.vercel-storage.com/media/test.pdf',
        }),
      } as any

      const mediaPart = {
        mediaId: 'test-id',
        type: 'pdf' as const,
        absoluteFilePath: '/nonexistent/file.pdf',
        publicUrl: 'https://example.blob.vercel-storage.com/media/test.pdf',
        mimeType: 'application/pdf',
      }

      const result = await mapMultimodalToGemini([mediaPart], mockPayload)

      // Should return empty array (no parts) when fetch fails
      expect(result.currentMessage).toHaveLength(0)

      // Should log the error
      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('isMediaTypeSupported', () => {
    it('should support PDF and image types', async () => {
      const { isMediaTypeSupported } =
        await import('@/infra/llm/providers/gemini/multimodal-mapper')

      expect(isMediaTypeSupported('pdf')).toBe(true)
      expect(isMediaTypeSupported('image')).toBe(true)
    })

    it('should not support other types', async () => {
      const { isMediaTypeSupported } =
        await import('@/infra/llm/providers/gemini/multimodal-mapper')

      expect(isMediaTypeSupported('video' as any)).toBe(false)
      expect(isMediaTypeSupported('audio' as any)).toBe(false)
    })
  })
})
