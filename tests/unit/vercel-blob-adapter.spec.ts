/**
 * Unit tests for Vercel Blob Adapter
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock @vercel/blob before importing the adapter
vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
  del: vi.fn(),
  list: vi.fn(),
}))

import {
  VercelBlobAdapter,
  createBlobAdapter,
  getBlobPathname,
  isVercelBlobUrl
} from '@/infra/blob/vercel-blob-adapter'
import { del, list, put } from '@vercel/blob'

describe('VercelBlobAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear environment variables
    delete process.env.BLOB_READ_WRITE_TOKEN
    delete process.env.BLOB_READONLY_TOKEN
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should throw error when BLOB_READ_WRITE_TOKEN is not set', () => {
      expect(() => new VercelBlobAdapter()).toThrow('Missing BLOB_READ_WRITE_TOKEN')
    })

    it('should throw error when BLOB_READONLY_TOKEN is not set for readOnly mode', () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token'
      expect(() => new VercelBlobAdapter({}, true)).toThrow('Missing BLOB_READONLY_TOKEN')
    })

    it('should initialize successfully with token', () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token'
      const adapter = new VercelBlobAdapter()
      expect(adapter).toBeInstanceOf(VercelBlobAdapter)
    })
  })

  describe('upload', () => {
    beforeEach(() => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token'
    })

    it('should upload file and return result', async () => {
      const mockResult = {
        url: 'https://example.blob.vercel-storage.com/media/test.pdf',
        pathname: 'media/test.pdf',
        contentDisposition: 'inline',
        contentType: 'application/pdf',
      }
      ;(put as any).mockResolvedValue(mockResult)

      const adapter = new VercelBlobAdapter()
      const result = await adapter.upload('test.pdf', Buffer.from('test data'), {
        contentType: 'application/pdf',
      })

      expect(put).toHaveBeenCalledWith(
        'media/test.pdf',
        expect.any(Buffer),
        expect.objectContaining({
          token: 'test-token',
          access: 'public',
          contentType: 'application/pdf',
        })
      )
      expect(result.url).toBe(mockResult.url)
      expect(result.pathname).toBe(mockResult.pathname)
    })

    it('should use custom directory from config', async () => {
      ;(put as any).mockResolvedValue({
        url: 'https://example.blob.vercel-storage.com/custom/test.pdf',
        pathname: 'custom/test.pdf',
      })

      const adapter = createBlobAdapter({ directory: 'custom' })
      await adapter.upload('test.pdf', Buffer.from('data'))

      expect(put).toHaveBeenCalledWith(
        'custom/test.pdf',
        expect.anything(),
        expect.anything()
      )
    })
  })

  describe('delete', () => {
    beforeEach(() => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token'
    })

    it('should delete file successfully', async () => {
      ;(del as any).mockResolvedValue(undefined)

      const adapter = new VercelBlobAdapter()
      const result = await adapter.delete('https://example.blob.vercel-storage.com/media/test.pdf')

      expect(del).toHaveBeenCalledWith(
        'https://example.blob.vercel-storage.com/media/test.pdf',
        { token: 'test-token' }
      )
      expect(result).toBe(true)
    })

    it('should return false when delete fails', async () => {
      ;(del as any).mockRejectedValue(new Error('Delete failed'))

      const adapter = new VercelBlobAdapter()
      const result = await adapter.delete('https://example.blob.vercel-storage.com/media/test.pdf')

      expect(result).toBe(false)
    })
  })

  describe('list', () => {
    beforeEach(() => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token'
    })

    it('should list blobs in directory', async () => {
      ;(list as any).mockResolvedValue({
        blobs: [
          {
            url: 'https://example.blob.vercel-storage.com/media/file1.pdf',
            pathname: 'media/file1.pdf',
            size: 1024,
            contentType: 'application/pdf',
            uploadedAt: new Date(),
          },
        ],
        cursor: 'next-cursor',
      })

      const adapter = new VercelBlobAdapter()
      const result = await adapter.list()

      expect(list).toHaveBeenCalledWith({
        token: 'test-token',
        prefix: 'media/',
        limit: 100,
        cursor: undefined,
      })
      expect(result.blobs).toHaveLength(1)
      expect(result.blobs[0].url).toBe('https://example.blob.vercel-storage.com/media/file1.pdf')
      expect(result.cursor).toBe('next-cursor')
      expect(result.hasMore).toBe(true)
    })

    it('should return hasMore=false when no cursor', async () => {
      ;(list as any).mockResolvedValue({
        blobs: [],
        cursor: undefined,
      })

      const adapter = new VercelBlobAdapter()
      const result = await adapter.list()

      expect(result.hasMore).toBe(false)
    })
  })

  describe('exists', () => {
    beforeEach(() => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token'
    })

    it('should return true when blob exists', async () => {
      ;(list as any).mockResolvedValue({
        blobs: [{ url: 'https://example.blob.vercel-storage.com/media/test.pdf' }],
      })

      const adapter = new VercelBlobAdapter()
      const result = await adapter.exists('https://example.blob.vercel-storage.com/media/test.pdf')

      expect(result).toBe(true)
    })

    it('should return false when blob does not exist', async () => {
      ;(list as any).mockResolvedValue({
        blobs: [],
      })

      const adapter = new VercelBlobAdapter()
      const result = await adapter.exists('https://example.blob.vercel-storage.com/media/test.pdf')

      expect(result).toBe(false)
    })
  })

  describe('getMetadata', () => {
    beforeEach(() => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token'
    })

    it('should return metadata when blob exists', async () => {
      ;(list as any).mockResolvedValue({
        blobs: [
          {
            url: 'https://example.blob.vercel-storage.com/media/test.pdf',
            pathname: 'media/test.pdf',
            size: 2048,
            contentType: 'application/pdf',
            uploadedAt: new Date('2024-01-01'),
          },
        ],
      })

      const adapter = new VercelBlobAdapter()
      const result = await adapter.getMetadata('https://example.blob.vercel-storage.com/media/test.pdf')

      expect(result).toEqual({
        pathname: 'media/test.pdf',
        size: 2048,
        contentType: 'application/pdf',
        uploadedAt: new Date('2024-01-01'),
      })
    })

    it('should return null when blob does not exist', async () => {
      ;(list as any).mockResolvedValue({
        blobs: [],
      })

      const adapter = new VercelBlobAdapter()
      const result = await adapter.getMetadata('https://example.blob.vercel-storage.com/media/test.pdf')

      expect(result).toBeNull()
    })
  })
})

describe('isVercelBlobUrl', () => {
  it('should return true for standard Vercel Blob URL', () => {
    expect(isVercelBlobUrl('https://example.blob.vercel-storage.com/media/test.pdf')).toBe(true)
  })

  it('should return true for public Vercel Blob URL', () => {
    expect(isVercelBlobUrl('https://96hg0ck1hvrndmxp.public.blob.vercel-storage.com/media/test.pdf')).toBe(true)
  })

  it('should return false for non-Vercel URL', () => {
    expect(isVercelBlobUrl('https://example.com/media/test.pdf')).toBe(false)
  })

  it('should return false for internal API route', () => {
    expect(isVercelBlobUrl('/api/media/file/test.pdf')).toBe(false)
  })
})

describe('getBlobPathname', () => {
  it('should extract pathname from Vercel Blob URL', () => {
    expect(getBlobPathname('https://example.blob.vercel-storage.com/media/test.pdf')).toBe('media/test.pdf')
  })

  it('should extract pathname from public Vercel Blob URL', () => {
    expect(getBlobPathname('https://96hg0ck1hvrndmxp.public.blob.vercel-storage.com/media/test.pdf')).toBe('media/test.pdf')
  })

  it('should handle URL with query parameters', () => {
    expect(getBlobPathname('https://example.blob.vercel-storage.com/media/test.pdf?token=abc')).toBe('media/test.pdf')
  })

  it('should return original string if no match', () => {
    expect(getBlobPathname('https://example.com/media/test.pdf')).toBe('https://example.com/media/test.pdf')
  })
})

// Note: getExternalStorageUrl tests are in pdf-fetcher-url-normalization.test.ts
// because it depends on environment variables that need to be set before module load
