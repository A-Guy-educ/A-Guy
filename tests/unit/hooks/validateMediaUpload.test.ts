import { describe, it, expect, vi } from 'vitest'

import { MediaType } from '@/infra/media/types'
import { validateMediaUploadHook } from '@/server/payload/collections/Media/hooks/validateMediaUpload'

// Helper to create a mock Payload req
function createMockReq() {
  return {
    payload: {
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    },
  } as unknown as Parameters<typeof validateMediaUploadHook>[0]['req']
}

// Helper to call the hook with minimal args
async function callHook({
  data = {},
  operation = 'create' as string,
}: {
  data?: Record<string, unknown>
  operation?: string
}) {
  return validateMediaUploadHook({
    data,
    operation,
    req: createMockReq(),
    collection: {} as unknown as Parameters<typeof validateMediaUploadHook>[0]['collection'],
    context: {},
    originalDoc: undefined,
  } as unknown as Parameters<typeof validateMediaUploadHook>[0])
}

describe('validateMediaUploadHook', () => {
  describe('External media (no file required)', () => {
    it('should allow External type with externalUrl and no file', async () => {
      const result = await callHook({
        data: {
          type: MediaType.External,
          externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        },
      })

      expect(result).toEqual({
        type: MediaType.External,
        externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        filename: 'www.youtube.com',
      })
    })

    it('should reject External type without externalUrl', async () => {
      await expect(
        callHook({
          data: {
            type: MediaType.External,
          },
        }),
      ).rejects.toThrow('External media requires an external URL')
    })

    it('should reject External type with empty externalUrl', async () => {
      await expect(
        callHook({
          data: {
            type: MediaType.External,
            externalUrl: '',
          },
        }),
      ).rejects.toThrow('External media requires an external URL')
    })

    it('should set filename from YouTube URL hostname', async () => {
      const result = await callHook({
        data: {
          type: MediaType.External,
          externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        },
      })

      expect(result.filename).toBe('www.youtube.com')
    })

    it('should set filename from custom URL hostname', async () => {
      const result = await callHook({
        data: {
          type: MediaType.External,
          externalUrl: 'https://vimeo.com/123456789',
        },
      })

      expect(result.filename).toBe('vimeo.com')
    })

    it('should set filename to "External" for invalid URL', async () => {
      const result = await callHook({
        data: {
          type: MediaType.External,
          externalUrl: 'not-a-valid-url',
        },
      })

      expect(result.filename).toBe('External')
    })

    it('should not overwrite pre-existing filename', async () => {
      const result = await callHook({
        data: {
          type: MediaType.External,
          externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          filename: 'My Custom Video',
        },
      })

      expect(result.filename).toBe('My Custom Video')
    })
  })

  describe('Non-external media (file required)', () => {
    it('should reject non-external type without a file', async () => {
      await expect(
        callHook({
          data: {
            type: MediaType.Image,
          },
        }),
      ).rejects.toThrow('A file is required for non-external media types')
    })

    it('should reject Other type without a file', async () => {
      await expect(
        callHook({
          data: {
            type: MediaType.Other,
          },
        }),
      ).rejects.toThrow('A file is required for non-external media types')
    })

    it('should allow Image type with mimeType and filename', async () => {
      const result = await callHook({
        data: {
          type: MediaType.Image,
          mimeType: 'image/jpeg',
          filename: 'photo.jpg',
          filesize: 1024,
        },
      })

      expect(result).toBeDefined()
      expect(result?.type).toBe(MediaType.Image)
    })

    it('should allow file with only mimeType (no filename)', async () => {
      const result = await callHook({
        data: {
          type: MediaType.Image,
          mimeType: 'image/jpeg',
          filesize: 1024,
        },
      })

      expect(result).toBeDefined()
    })

    it('should allow file with only filename (no mimeType)', async () => {
      const result = await callHook({
        data: {
          type: MediaType.Image,
          filename: 'photo.jpg',
          filesize: 1024,
        },
      })

      expect(result).toBeDefined()
    })
  })

  describe('MIME type validation', () => {
    it('should downgrade type to Other when MIME does not match', async () => {
      const result = await callHook({
        data: {
          type: MediaType.Image,
          mimeType: 'video/mp4',
          filename: 'clip.mp4',
          filesize: 1024,
        },
      })

      expect(result?.type).toBe(MediaType.Other)
    })

    it('should keep type when MIME matches', async () => {
      const result = await callHook({
        data: {
          type: MediaType.Image,
          mimeType: 'image/jpeg',
          filename: 'photo.jpg',
          filesize: 1024,
        },
      })

      expect(result?.type).toBe(MediaType.Image)
    })
  })

  describe('size limit enforcement', () => {
    it('should reject files exceeding size limit', async () => {
      await expect(
        callHook({
          data: {
            type: MediaType.Image,
            mimeType: 'image/jpeg',
            filename: 'huge.jpg',
            filesize: 50 * 1024 * 1024, // 50MB, limit is 10MB
          },
        }),
      ).rejects.toThrow(/exceeds maximum/)
    })

    it('should allow files within size limit', async () => {
      const result = await callHook({
        data: {
          type: MediaType.Image,
          mimeType: 'image/jpeg',
          filename: 'small.jpg',
          filesize: 5 * 1024 * 1024, // 5MB, limit is 10MB
        },
      })

      expect(result).toBeDefined()
    })
  })

  describe('operation handling', () => {
    it('should skip validation on update operations', async () => {
      const result = await callHook({
        data: {},
        operation: 'update',
      })

      // Should return data unchanged — no validation on update
      expect(result).toEqual({})
    })

    it('should skip validation on delete operations', async () => {
      const result = await callHook({
        data: {},
        operation: 'delete',
      })

      expect(result).toEqual({})
    })
  })
})
