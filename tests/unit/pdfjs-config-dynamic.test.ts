/**
 * Tests for dynamic PDF.js CDN configuration
 * These tests verify that the CDN base URL is resolved dynamically from Vercel Blob
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the vercel-blob-adapter module
vi.mock('@/infra/blob/vercel-blob-adapter', () => ({
  getExternalStorageUrl: vi.fn(),
}))

import { getExternalStorageUrl } from '@/infra/blob/vercel-blob-adapter'
import { PDFJS_VERSION, PDF_JS_DIR } from '@/infra/pdfjs/config'

describe('PDF.js Dynamic CDN Configuration', () => {
  const mockExternalUrl = 'https://example.blob.vercel-storage.com'

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the cached CDN base by clearing the module cache
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('PDF_JS_DIR', () => {
    it('should contain version in directory path', () => {
      expect(PDF_JS_DIR).toBe(`pdfjs/${PDFJS_VERSION}`)
      expect(PDF_JS_DIR).toContain('pdfjs/')
      expect(PDF_JS_DIR).toContain('4.4.168')
    })
  })

  describe('getCdnBase', () => {
    it('should return URL with external storage base and PDF.js directory', async () => {
      vi.mocked(getExternalStorageUrl).mockResolvedValue(mockExternalUrl)

      // Re-import to get fresh module state
      const { getCdnBase: getCdnBaseFresh } = await import('@/infra/pdfjs/config')
      const result = await getCdnBaseFresh()

      expect(result).toBe(`${mockExternalUrl}/pdfjs/${PDFJS_VERSION}`)
      expect(getExternalStorageUrl).toHaveBeenCalledTimes(1)
    })

    it('should memoize the CDN base URL', async () => {
      vi.mocked(getExternalStorageUrl).mockResolvedValue(mockExternalUrl)

      const { getCdnBase: getCdnBaseFresh } = await import('@/infra/pdfjs/config')
      const result1 = await getCdnBaseFresh()
      const result2 = await getCdnBaseFresh()

      expect(result1).toBe(result2)
      expect(getExternalStorageUrl).toHaveBeenCalledTimes(1)
    })

    it('should return empty base URL if external storage URL is empty', async () => {
      vi.mocked(getExternalStorageUrl).mockResolvedValue('')

      const { getCdnBase: getCdnBaseFresh } = await import('@/infra/pdfjs/config')
      const result = await getCdnBaseFresh()
      expect(result).toBe(`/pdfjs/${PDFJS_VERSION}`)
    })
  })

  describe('getViewerUrls', () => {
    it('should return all viewer URLs with dynamic CDN base', async () => {
      vi.mocked(getExternalStorageUrl).mockResolvedValue(mockExternalUrl)

      const { getViewerUrls: getViewerUrlsFresh } = await import('@/infra/pdfjs/config')
      const urls = await getViewerUrlsFresh()

      expect(urls.html).toContain(mockExternalUrl)
      expect(urls.mjs).toContain(mockExternalUrl)
      expect(urls.css).toContain(mockExternalUrl)
      expect(urls.pdfMjs).toContain(mockExternalUrl)
      expect(urls.pdfWorkerMjs).toContain(mockExternalUrl)
      expect(urls.pdfWorkerMjs).toContain('pdf.worker.mjs')
      expect(urls.pdfWorkerMjs).toContain('build/')
    })

    it('should include pdfWorkerMjs for server-side PDF processing', async () => {
      vi.mocked(getExternalStorageUrl).mockResolvedValue(mockExternalUrl)

      const { getViewerUrls: getViewerUrlsFresh } = await import('@/infra/pdfjs/config')
      const urls = await getViewerUrlsFresh()

      expect(urls.pdfWorkerMjs).toBeDefined()
      expect(urls.pdfWorkerMjs).toMatch(/pdf\.worker\.mjs$/)
    })

    it('should return consistent URLs across multiple calls', async () => {
      vi.mocked(getExternalStorageUrl).mockResolvedValue(mockExternalUrl)

      const { getViewerUrls: getViewerUrlsFresh } = await import('@/infra/pdfjs/config')
      const urls1 = await getViewerUrlsFresh()
      const urls2 = await getViewerUrlsFresh()

      expect(urls1).toEqual(urls2)
    })
  })

  describe('getPdfWorkerUrl', () => {
    it('should return the worker URL for server-side PDF processing', async () => {
      vi.mocked(getExternalStorageUrl).mockResolvedValue(mockExternalUrl)

      const { getPdfWorkerUrl: getPdfWorkerUrlFresh } = await import('@/infra/pdfjs/config')
      const workerUrl = await getPdfWorkerUrlFresh()

      expect(workerUrl).toBe(`${mockExternalUrl}/pdfjs/${PDFJS_VERSION}/build/pdf.worker.mjs`)
      expect(workerUrl).toMatch(/pdf\.worker\.mjs$/)
    })

    it('should be usable with pdfjs-dist GlobalWorkerOptions', async () => {
      vi.mocked(getExternalStorageUrl).mockResolvedValue(mockExternalUrl)

      const { getPdfWorkerUrl: getPdfWorkerUrlFresh } = await import('@/infra/pdfjs/config')
      const workerUrl = await getPdfWorkerUrlFresh()

      // Verify the URL is valid for use as workerSrc
      expect(workerUrl.startsWith('https://')).toBe(true)
      expect(workerUrl.endsWith('.mjs')).toBe(true)
    })
  })

  describe('URL structure', () => {
    it('should have proper URL structure for Vercel Blob CDN', async () => {
      vi.mocked(getExternalStorageUrl).mockResolvedValue(mockExternalUrl)

      const { getViewerUrls: getViewerUrlsFresh } = await import('@/infra/pdfjs/config')
      const urls = await getViewerUrlsFresh()

      // All URLs should be HTTPS
      Object.values(urls).forEach((url) => {
        expect(url.startsWith('https://')).toBe(true)
      })

      // All URLs should contain the PDF.js version directory
      Object.values(urls).forEach((url) => {
        expect(url).toContain(PDFJS_VERSION)
      })
    })
  })
})
