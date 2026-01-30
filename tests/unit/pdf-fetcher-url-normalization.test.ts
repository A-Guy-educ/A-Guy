/**
 * Unit tests for PDF fetcher URL normalization
 */

import { beforeEach, describe, expect, it } from 'vitest'

// Helper to simulate getExternalStorageUrl behavior
function getExternalStorageUrl(): string {
  if (process.env.NEXT_PUBLIC_EXTERNAL_STORAGE_URL) {
    return process.env.NEXT_PUBLIC_EXTERNAL_STORAGE_URL.replace(/\/$/, '')
  }
  if (process.env.NEXT_PUBLIC_DEPLOYMENT_URL) {
    return process.env.NEXT_PUBLIC_DEPLOYMENT_URL.replace(/\/$/, '')
  }
  return 'http://localhost:3000'
}

// Copy of the normalizeToAbsoluteUrl function for testing
function normalizeToAbsoluteUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  if (url.startsWith('/')) {
    const baseUrl = getExternalStorageUrl()
    return `${baseUrl}${url}`
  }
  return url
}

describe('PDF Fetcher URL Normalization', () => {
  describe('normalizeToAbsoluteUrl', () => {
    beforeEach(() => {
      // Clear environment variables before each test
      delete process.env.NEXT_PUBLIC_EXTERNAL_STORAGE_URL
      delete process.env.NEXT_PUBLIC_DEPLOYMENT_URL
    })

    it('should return absolute HTTPS URL unchanged', () => {
      expect(normalizeToAbsoluteUrl('https://example.com/file.pdf')).toBe('https://example.com/file.pdf')
    })

    it('should return absolute HTTP URL unchanged', () => {
      expect(normalizeToAbsoluteUrl('http://example.com/file.pdf')).toBe('http://example.com/file.pdf')
    })

    it('should prepend base URL to relative path starting with /', () => {
      process.env.NEXT_PUBLIC_EXTERNAL_STORAGE_URL = 'https://cdn.example.com'
      expect(normalizeToAbsoluteUrl('/api/media/file/test.pdf')).toBe('https://cdn.example.com/api/media/file/test.pdf')
    })

    it('should use NEXT_PUBLIC_DEPLOYMENT_URL when EXTERNAL_STORAGE_URL not set', () => {
      process.env.NEXT_PUBLIC_DEPLOYMENT_URL = 'https://myapp.vercel.app'
      expect(normalizeToAbsoluteUrl('/api/media/file/test.pdf')).toBe('https://myapp.vercel.app/api/media/file/test.pdf')
    })

    it('should fallback to localhost for relative URLs when no env vars set', () => {
      expect(normalizeToAbsoluteUrl('/api/media/file/test.pdf')).toBe('http://localhost:3000/api/media/file/test.pdf')
    })

    it('should handle URLs with encoded characters', () => {
      process.env.NEXT_PUBLIC_EXTERNAL_STORAGE_URL = 'https://cdn.example.com'
      expect(normalizeToAbsoluteUrl('/api/media/file/Math%20-%205units.pdf')).toBe('https://cdn.example.com/api/media/file/Math%20-%205units.pdf')
    })

    it('should handle Vercel Blob URLs unchanged', () => {
      expect(normalizeToAbsoluteUrl('https://example.blob.vercel-storage.com/media/test.pdf')).toBe('https://example.blob.vercel-storage.com/media/test.pdf')
    })

    it('should handle public Vercel Blob URLs unchanged', () => {
      expect(normalizeToAbsoluteUrl('https://96hg0ck1hvrndmxp.public.blob.vercel-storage.com/media/test.pdf')).toBe('https://96hg0ck1hvrndmxp.public.blob.vercel-storage.com/media/test.pdf')
    })

    it('should strip trailing slash from base URL', () => {
      process.env.NEXT_PUBLIC_EXTERNAL_STORAGE_URL = 'https://cdn.example.com/'
      expect(normalizeToAbsoluteUrl('/api/media/file/test.pdf')).toBe('https://cdn.example.com/api/media/file/test.pdf')
    })

    it('should handle the original error case - relative URL with encoded filename', () => {
      process.env.NEXT_PUBLIC_EXTERNAL_STORAGE_URL = 'https://myapp.vercel.app'
      const encodedFilename = 'processed_Math%20-%205units%20-%20571%20-%202011%20-%20summer.pdf'
      const result = normalizeToAbsoluteUrl(`/api/media/file/${encodedFilename}`)
      expect(result).toBe('https://myapp.vercel.app/api/media/file/processed_Math%20-%205units%20-%20571%20-%202011%20-%20summer.pdf')
    })
  })

  describe('getExternalStorageUrl', () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_EXTERNAL_STORAGE_URL
      delete process.env.NEXT_PUBLIC_DEPLOYMENT_URL
    })

    it('should return NEXT_PUBLIC_EXTERNAL_STORAGE_URL when set', () => {
      process.env.NEXT_PUBLIC_EXTERNAL_STORAGE_URL = 'https://cdn.example.com'
      expect(getExternalStorageUrl()).toBe('https://cdn.example.com')
    })

    it('should return NEXT_PUBLIC_DEPLOYMENT_URL when EXTERNAL_STORAGE_URL not set', () => {
      process.env.NEXT_PUBLIC_DEPLOYMENT_URL = 'https://myapp.vercel.app'
      expect(getExternalStorageUrl()).toBe('https://myapp.vercel.app')
    })

    it('should fallback to localhost in development', () => {
      expect(getExternalStorageUrl()).toBe('http://localhost:3000')
    })

    it('should strip trailing slash from URL', () => {
      process.env.NEXT_PUBLIC_EXTERNAL_STORAGE_URL = 'https://cdn.example.com/'
      expect(getExternalStorageUrl()).toBe('https://cdn.example.com')
    })
  })
})
