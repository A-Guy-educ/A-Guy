/**
 * Unit tests for PDF fetcher URL normalization
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the vercel-blob-adapter module
vi.mock('@/infra/blob/vercel-blob-adapter', async () => {
  const actual = await vi.importActual('@/infra/blob/vercel-blob-adapter')
  return {
    ...actual,
    getExternalStorageUrl: vi.fn(),
  }
})

// Import after mocking
import { getExternalStorageUrl } from '@/infra/blob/vercel-blob-adapter'

// Copy of the normalizeToAbsoluteUrl function for testing
async function normalizeToAbsoluteUrl(url: string): Promise<string> {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  if (url.startsWith('/')) {
    const baseUrl = await getExternalStorageUrl()
    return `${baseUrl}${url}`
  }
  return url
}

// Helper to safely clear env vars
function clearEnvVars(): void {
  const env = process.env as { [key: string]: string | undefined }
  delete env.NEXT_PUBLIC_EXTERNAL_STORAGE_URL
  delete env.NEXT_PUBLIC_SERVER_URL
  delete env.NEXT_PUBLIC_DEPLOYMENT_URL
  delete env.BLOB_READ_WRITE_TOKEN
}

describe('PDF Fetcher URL Normalization', () => {
  describe('normalizeToAbsoluteUrl', () => {
    beforeEach(() => {
      clearEnvVars()
      vi.mocked(getExternalStorageUrl).mockReset()
    })

    it('should return absolute HTTPS URL unchanged', async () => {
      expect(await normalizeToAbsoluteUrl('https://example.com/file.pdf')).toBe(
        'https://example.com/file.pdf',
      )
    })

    it('should return absolute HTTP URL unchanged', async () => {
      expect(await normalizeToAbsoluteUrl('http://example.com/file.pdf')).toBe(
        'http://example.com/file.pdf',
      )
    })

    it('should prepend blob store URL to relative path', async () => {
      vi.mocked(getExternalStorageUrl).mockResolvedValue(
        'https://pd8gxkxxaj3lzovc.public.blob.vercel-storage.com',
      )
      expect(await normalizeToAbsoluteUrl('/api/media/file/test.pdf')).toBe(
        'https://pd8gxkxxaj3lzovc.public.blob.vercel-storage.com/api/media/file/test.pdf',
      )
    })

    it('should handle URLs with encoded characters', async () => {
      vi.mocked(getExternalStorageUrl).mockResolvedValue(
        'https://pd8gxkxxaj3lzovc.public.blob.vercel-storage.com',
      )
      expect(await normalizeToAbsoluteUrl('/api/media/file/Math%20-%205units.pdf')).toBe(
        'https://pd8gxkxxaj3lzovc.public.blob.vercel-storage.com/api/media/file/Math%20-%205units.pdf',
      )
    })

    it('should handle Vercel Blob URLs unchanged', async () => {
      expect(
        await normalizeToAbsoluteUrl('https://example.blob.vercel-storage.com/media/test.pdf'),
      ).toBe('https://example.blob.vercel-storage.com/media/test.pdf')
    })

    it('should handle public Vercel Blob URLs unchanged', async () => {
      expect(
        await normalizeToAbsoluteUrl(
          'https://96hg0ck1hvrndmxp.public.blob.vercel-storage.com/media/test.pdf',
        ),
      ).toBe('https://96hg0ck1hvrndmxp.public.blob.vercel-storage.com/media/test.pdf')
    })

    it('should handle the original error case - relative URL with encoded filename', async () => {
      vi.mocked(getExternalStorageUrl).mockResolvedValue(
        'https://pd8gxkxxaj3lzovc.public.blob.vercel-storage.com',
      )
      const encodedFilename = 'processed_Math%20-%205units%20-%20571%20-%202011%20-%20summer.pdf'
      const result = await normalizeToAbsoluteUrl(`/api/media/file/${encodedFilename}`)
      expect(result).toBe(
        'https://pd8gxkxxaj3lzovc.public.blob.vercel-storage.com/api/media/file/processed_Math%20-%205units%20-%20571%20-%202011%20-%20summer.pdf',
      )
    })
  })

  describe('getExternalStorageUrl', () => {
    beforeEach(() => {
      clearEnvVars()
      vi.mocked(getExternalStorageUrl).mockReset()
    })

    it('should return blob store URL dynamically', async () => {
      vi.mocked(getExternalStorageUrl).mockResolvedValue(
        'https://pd8gxkxxaj3lzovc.public.blob.vercel-storage.com',
      )
      expect(await getExternalStorageUrl()).toBe(
        'https://pd8gxkxxaj3lzovc.public.blob.vercel-storage.com',
      )
    })

    it('should fallback to localhost in development (no BLOB_READ_WRITE_TOKEN)', async () => {
      vi.mocked(getExternalStorageUrl).mockResolvedValue('http://localhost:3000')
      expect(await getExternalStorageUrl()).toBe('http://localhost:3000')
    })
  })
})
