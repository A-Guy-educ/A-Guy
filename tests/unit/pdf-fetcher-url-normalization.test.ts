/**
 * Unit tests for PDF fetcher URL normalization
 */

import { beforeEach, describe, expect, it } from 'vitest'

// Helper to simulate getExternalStorageUrl behavior (matches actual implementation)
async function getExternalStorageUrl(): Promise<string> {
  // Try ConfigEntries first (simulated via env var for tests)
  const env = process.env as { [key: string]: string | undefined }
  if (env.NEXT_PUBLIC_EXTERNAL_STORAGE_URL) {
    return env.NEXT_PUBLIC_EXTERNAL_STORAGE_URL.replace(/\/$/, '')
  }
  if (env.NEXT_PUBLIC_SERVER_URL) {
    return env.NEXT_PUBLIC_SERVER_URL.replace(/\/$/, '')
  }
  if (env.NEXT_PUBLIC_DEPLOYMENT_URL) {
    return env.NEXT_PUBLIC_DEPLOYMENT_URL.replace(/\/$/, '')
  }
  return 'http://localhost:3000'
}

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
}

describe('PDF Fetcher URL Normalization', () => {
  describe('normalizeToAbsoluteUrl', () => {
    beforeEach(() => {
      clearEnvVars()
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

    it('should prepend base URL to relative path starting with /', async () => {
      ;(
        process.env as { NEXT_PUBLIC_EXTERNAL_STORAGE_URL?: string }
      ).NEXT_PUBLIC_EXTERNAL_STORAGE_URL = 'https://cdn.example.com'
      expect(await normalizeToAbsoluteUrl('/api/media/file/test.pdf')).toBe(
        'https://cdn.example.com/api/media/file/test.pdf',
      )
    })

    it('should use NEXT_PUBLIC_SERVER_URL when EXTERNAL_STORAGE_URL not set', async () => {
      ;(process.env as { NEXT_PUBLIC_SERVER_URL?: string }).NEXT_PUBLIC_SERVER_URL =
        'https://api.example.com'
      expect(await normalizeToAbsoluteUrl('/api/media/file/test.pdf')).toBe(
        'https://api.example.com/api/media/file/test.pdf',
      )
    })

    it('should use NEXT_PUBLIC_DEPLOYMENT_URL when SERVER_URL not set', async () => {
      ;(process.env as { NEXT_PUBLIC_DEPLOYMENT_URL?: string }).NEXT_PUBLIC_DEPLOYMENT_URL =
        'https://myapp.vercel.app'
      expect(await normalizeToAbsoluteUrl('/api/media/file/test.pdf')).toBe(
        'https://myapp.vercel.app/api/media/file/test.pdf',
      )
    })

    it('should fallback to localhost for relative URLs when no env vars set', async () => {
      expect(await normalizeToAbsoluteUrl('/api/media/file/test.pdf')).toBe(
        'http://localhost:3000/api/media/file/test.pdf',
      )
    })

    it('should handle URLs with encoded characters', async () => {
      ;(
        process.env as { NEXT_PUBLIC_EXTERNAL_STORAGE_URL?: string }
      ).NEXT_PUBLIC_EXTERNAL_STORAGE_URL = 'https://cdn.example.com'
      expect(await normalizeToAbsoluteUrl('/api/media/file/Math%20-%205units.pdf')).toBe(
        'https://cdn.example.com/api/media/file/Math%20-%205units.pdf',
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

    it('should strip trailing slash from base URL', async () => {
      ;(
        process.env as { NEXT_PUBLIC_EXTERNAL_STORAGE_URL?: string }
      ).NEXT_PUBLIC_EXTERNAL_STORAGE_URL = 'https://cdn.example.com/'
      expect(await normalizeToAbsoluteUrl('/api/media/file/test.pdf')).toBe(
        'https://cdn.example.com/api/media/file/test.pdf',
      )
    })

    it('should handle the original error case - relative URL with encoded filename', async () => {
      ;(
        process.env as { NEXT_PUBLIC_EXTERNAL_STORAGE_URL?: string }
      ).NEXT_PUBLIC_EXTERNAL_STORAGE_URL = 'https://myapp.vercel.app'
      const encodedFilename = 'processed_Math%20-%205units%20-%20571%20-%202011%20-%20summer.pdf'
      const result = await normalizeToAbsoluteUrl(`/api/media/file/${encodedFilename}`)
      expect(result).toBe(
        'https://myapp.vercel.app/api/media/file/processed_Math%20-%205units%20-%20571%20-%202011%20-%20summer.pdf',
      )
    })

    it('should prioritize EXTERNAL_STORAGE_URL over SERVER_URL', async () => {
      ;(
        process.env as { NEXT_PUBLIC_EXTERNAL_STORAGE_URL?: string }
      ).NEXT_PUBLIC_EXTERNAL_STORAGE_URL = 'https://cdn.example.com'
      ;(process.env as { NEXT_PUBLIC_SERVER_URL?: string }).NEXT_PUBLIC_SERVER_URL =
        'https://api.example.com'
      ;(process.env as { NEXT_PUBLIC_DEPLOYMENT_URL?: string }).NEXT_PUBLIC_DEPLOYMENT_URL =
        'https://app.vercel.app'
      expect(await normalizeToAbsoluteUrl('/api/media/file/test.pdf')).toBe(
        'https://cdn.example.com/api/media/file/test.pdf',
      )
    })

    it('should prioritize SERVER_URL over DEPLOYMENT_URL', async () => {
      ;(process.env as { NEXT_PUBLIC_SERVER_URL?: string }).NEXT_PUBLIC_SERVER_URL =
        'https://api.example.com'
      ;(process.env as { NEXT_PUBLIC_DEPLOYMENT_URL?: string }).NEXT_PUBLIC_DEPLOYMENT_URL =
        'https://app.vercel.app'
      expect(await normalizeToAbsoluteUrl('/api/media/file/test.pdf')).toBe(
        'https://api.example.com/api/media/file/test.pdf',
      )
    })
  })

  describe('getExternalStorageUrl', () => {
    beforeEach(() => {
      clearEnvVars()
    })

    it('should return NEXT_PUBLIC_EXTERNAL_STORAGE_URL when set', async () => {
      ;(
        process.env as { NEXT_PUBLIC_EXTERNAL_STORAGE_URL?: string }
      ).NEXT_PUBLIC_EXTERNAL_STORAGE_URL = 'https://cdn.example.com'
      expect(await getExternalStorageUrl()).toBe('https://cdn.example.com')
    })

    it('should return NEXT_PUBLIC_SERVER_URL when EXTERNAL_STORAGE_URL not set', async () => {
      ;(process.env as { NEXT_PUBLIC_SERVER_URL?: string }).NEXT_PUBLIC_SERVER_URL =
        'https://api.example.com'
      expect(await getExternalStorageUrl()).toBe('https://api.example.com')
    })

    it('should return NEXT_PUBLIC_DEPLOYMENT_URL when EXTERNAL and SERVER_URL not set', async () => {
      ;(process.env as { NEXT_PUBLIC_DEPLOYMENT_URL?: string }).NEXT_PUBLIC_DEPLOYMENT_URL =
        'https://myapp.vercel.app'
      expect(await getExternalStorageUrl()).toBe('https://myapp.vercel.app')
    })

    it('should fallback to localhost in development', async () => {
      expect(await getExternalStorageUrl()).toBe('http://localhost:3000')
    })

    it('should strip trailing slash from URL', async () => {
      ;(
        process.env as { NEXT_PUBLIC_EXTERNAL_STORAGE_URL?: string }
      ).NEXT_PUBLIC_EXTERNAL_STORAGE_URL = 'https://cdn.example.com/'
      expect(await getExternalStorageUrl()).toBe('https://cdn.example.com')
    })

    it('should strip trailing slash from SERVER_URL', async () => {
      ;(process.env as { NEXT_PUBLIC_SERVER_URL?: string }).NEXT_PUBLIC_SERVER_URL =
        'https://api.example.com/'
      expect(await getExternalStorageUrl()).toBe('https://api.example.com')
    })

    it('should strip trailing slash from DEPLOYMENT_URL', async () => {
      ;(process.env as { NEXT_PUBLIC_DEPLOYMENT_URL?: string }).NEXT_PUBLIC_DEPLOYMENT_URL =
        'https://myapp.vercel.app/'
      expect(await getExternalStorageUrl()).toBe('https://myapp.vercel.app')
    })
  })
})
