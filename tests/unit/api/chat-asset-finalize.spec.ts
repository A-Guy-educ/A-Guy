/**
 * Unit tests for Chat Asset Finalize Route
 * Tests the getImageDimensionsFromUrl function and error handling
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { getImageDimensionsFromUrl } from '@/app/api/chat-assets/finalize/route'

// Mock sharp module
vi.mock('sharp', () => ({
  default: vi.fn().mockImplementation(() => ({
    metadata: vi.fn(),
  })),
}))

describe('getImageDimensionsFromUrl', () => {
  // Valid JPEG magic bytes
  const validJPEG = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ])

  // Valid PNG magic bytes
  const validPNG = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ])

  // Valid WebP magic bytes (RIFF...WEBP)
  const validWebP = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ])

  // Valid GIF magic bytes
  const validGIF = new Uint8Array([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ])

  // Invalid: not an image (random bytes)
  const invalidBytes = new Uint8Array([
    0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb,
  ])

  // Mock fetch globally
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('returns { error: "network" }', () => {
    it('when fetch returns non-ok status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      })

      const result = await getImageDimensionsFromUrl('https://example.com/image.jpg')

      expect(result).toEqual({ error: 'network' })
    })

    it('when fetch promise rejects - returns corrupted (catch-all for promise rejections)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await getImageDimensionsFromUrl('https://example.com/image.jpg')

      // Note: fetch exceptions are caught in the outer catch and treated as 'corrupted'
      // since we can't differentiate between network errors and image processing errors
      expect(result).toEqual({ error: 'corrupted' })
    })
  })

  describe('returns { error: "invalid_format" }', () => {
    it('when buffer is too short', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([0xff, 0xd8])),
      })

      const result = await getImageDimensionsFromUrl('https://example.com/image.jpg')

      expect(result).toEqual({ error: 'invalid_format' })
    })

    it('when buffer has invalid magic bytes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(invalidBytes),
      })

      const result = await getImageDimensionsFromUrl('https://example.com/file.txt')

      expect(result).toEqual({ error: 'invalid_format' })
    })
  })

  describe('returns { error: "corrupted" }', () => {
    it('when sharp throws an exception on valid JPEG header', async () => {
      // Valid JPEG header but sharp will fail (metadata throws)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(validJPEG),
      })

      const sharp = await import('sharp')
      const mockSharp = sharp.default as unknown as ReturnType<typeof vi.fn>
      mockSharp.mockImplementationOnce(() => ({
        metadata: vi.fn().mockRejectedValueOnce(new Error('Sharp error')),
      }))

      const result = await getImageDimensionsFromUrl('https://example.com/corrupt.jpg')

      expect(result).toEqual({ error: 'corrupted' })
    })

    it('when sharp returns missing dimensions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(validJPEG),
      })

      const sharp = await import('sharp')
      const mockSharp = sharp.default as unknown as ReturnType<typeof vi.fn>
      mockSharp.mockImplementationOnce(() => ({
        metadata: vi.fn().mockResolvedValue({ width: undefined, height: undefined }),
      }))

      const result = await getImageDimensionsFromUrl('https://example.com/nodims.jpg')

      expect(result).toEqual({ error: 'corrupted' })
    })
  })

  describe('returns dimensions for valid images', () => {
    it('returns dimensions for valid JPEG', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(validJPEG),
      })

      const sharp = await import('sharp')
      const mockSharp = sharp.default as unknown as ReturnType<typeof vi.fn>
      mockSharp.mockImplementationOnce(() => ({
        metadata: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
      }))

      const result = await getImageDimensionsFromUrl('https://example.com/valid.jpg')

      expect(result).toEqual({ width: 800, height: 600 })
    })

    it('returns dimensions for valid PNG', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(validPNG),
      })

      const sharp = await import('sharp')
      const mockSharp = sharp.default as unknown as ReturnType<typeof vi.fn>
      mockSharp.mockImplementationOnce(() => ({
        metadata: vi.fn().mockResolvedValue({ width: 1024, height: 768 }),
      }))

      const result = await getImageDimensionsFromUrl('https://example.com/valid.png')

      expect(result).toEqual({ width: 1024, height: 768 })
    })

    it('returns dimensions for valid WebP', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(validWebP),
      })

      const sharp = await import('sharp')
      const mockSharp = sharp.default as unknown as ReturnType<typeof vi.fn>
      mockSharp.mockImplementationOnce(() => ({
        metadata: vi.fn().mockResolvedValue({ width: 1920, height: 1080 }),
      }))

      const result = await getImageDimensionsFromUrl('https://example.com/valid.webp')

      expect(result).toEqual({ width: 1920, height: 1080 })
    })

    it('returns dimensions for valid GIF', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(validGIF),
      })

      const sharp = await import('sharp')
      const mockSharp = sharp.default as unknown as ReturnType<typeof vi.fn>
      mockSharp.mockImplementationOnce(() => ({
        metadata: vi.fn().mockResolvedValue({ width: 640, height: 480 }),
      }))

      const result = await getImageDimensionsFromUrl('https://example.com/valid.gif')

      expect(result).toEqual({ width: 640, height: 480 })
    })
  })

  describe('image format detection', () => {
    it.each([
      { name: 'JPEG', bytes: validJPEG, expected: true },
      { name: 'PNG', bytes: validPNG, expected: true },
      { name: 'WebP', bytes: validWebP, expected: true },
      { name: 'GIF', bytes: validGIF, expected: true },
      { name: 'invalid', bytes: invalidBytes, expected: false },
    ])('correctly identifies $name format', async ({ bytes, expected }) => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(bytes),
      })

      // Mock sharp to return dimensions for valid formats
      const sharp = await import('sharp')
      const mockSharp = sharp.default as unknown as ReturnType<typeof vi.fn>
      if (expected) {
        mockSharp.mockImplementationOnce(() => ({
          metadata: vi.fn().mockResolvedValue({ width: 100, height: 100 }),
        }))
      } else {
        // Invalid formats will fail at magic byte check
      }

      const result = await getImageDimensionsFromUrl(
        `https://example.com/test.${expected ? 'jpg' : 'txt'}`,
      )

      if (expected) {
        expect(result).toHaveProperty('width')
        expect(result).toHaveProperty('height')
      } else {
        expect(result).toEqual({ error: 'invalid_format' })
      }
    })
  })
})
