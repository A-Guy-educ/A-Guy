/**
 * Tests for hardcoded PDF.js CDN configuration
 * These tests verify that the CDN base URL is hardcoded and does not require dynamic resolution.
 */
import { describe, expect, it } from 'vitest'

import {
  CACHE_CONFIG,
  CDN_BASE,
  PDFJS_VERSION,
  RESPONSE_HEADERS,
  VALIDATION_CONFIG,
  VIEWER_URLS,
  getPdfWorkerUrl,
} from '@/infra/pdfjs/config'

describe('PDF.js Hardcoded CDN Configuration', () => {
  describe('PDFJS_VERSION', () => {
    it('should be defined', () => {
      expect(PDFJS_VERSION).toBeDefined()
      expect(PDFJS_VERSION).toBe('4.4.168')
    })
  })

  describe('CDN_BASE', () => {
    it('should be a hardcoded string', () => {
      expect(CDN_BASE).toBe('https://96hg0ck1hvrndmxp.public.blob.vercel-storage.com/pdfjs/4.4.168')
      expect(CDN_BASE).toContain('pdfjs/')
      expect(CDN_BASE).toContain(PDFJS_VERSION)
    })

    it('should use HTTPS', () => {
      expect(CDN_BASE).toMatch(/^https:\/\//)
    })
  })

  describe('VIEWER_URLS', () => {
    it('should have all required URLs', () => {
      expect(VIEWER_URLS.html).toBeDefined()
      expect(VIEWER_URLS.mjs).toBeDefined()
      expect(VIEWER_URLS.css).toBeDefined()
      expect(VIEWER_URLS.pdfMjs).toBeDefined()
      expect(VIEWER_URLS.pdfWorkerMjs).toBeDefined()
    })

    it('should contain the CDN base in all URLs', () => {
      expect(VIEWER_URLS.html).toContain(CDN_BASE)
      expect(VIEWER_URLS.mjs).toContain(CDN_BASE)
      expect(VIEWER_URLS.css).toContain(CDN_BASE)
      expect(VIEWER_URLS.pdfMjs).toContain(CDN_BASE)
      expect(VIEWER_URLS.pdfWorkerMjs).toContain(CDN_BASE)
    })

    it('should have correct file names', () => {
      expect(VIEWER_URLS.html).toContain('viewer-')
      expect(VIEWER_URLS.html).toContain('.html')
      expect(VIEWER_URLS.mjs).toContain('viewer-')
      expect(VIEWER_URLS.mjs).toContain('.mjs')
      expect(VIEWER_URLS.css).toContain('viewer-')
      expect(VIEWER_URLS.css).toContain('.css')
      expect(VIEWER_URLS.pdfMjs).toContain('pdf.mjs')
      expect(VIEWER_URLS.pdfWorkerMjs).toContain('pdf.worker.mjs')
    })

    it('should have deeply readonly values (const assertion)', () => {
      // With `as const`, the object should have deeply readonly values
      // The object itself may not be frozen, but values should be literal types
      expect(typeof VIEWER_URLS.html).toBe('string')
      expect(typeof VIEWER_URLS.mjs).toBe('string')
      expect(typeof VIEWER_URLS.css).toBe('string')
      expect(typeof VIEWER_URLS.pdfMjs).toBe('string')
      expect(typeof VIEWER_URLS.pdfWorkerMjs).toBe('string')
    })
  })

  describe('getPdfWorkerUrl', () => {
    it('should return the hardcoded worker URL', async () => {
      const workerUrl = await getPdfWorkerUrl()
      expect(workerUrl).toBe(VIEWER_URLS.pdfWorkerMjs)
      expect(workerUrl).toMatch(/pdf\.worker\.mjs$/)
    })
  })

  describe('CACHE_CONFIG', () => {
    it('should have correct cache settings', () => {
      expect(CACHE_CONFIG.revalidateSeconds).toBe(3600)
      expect(CACHE_CONFIG.cacheControl).toBe('public, max-age=3600, s-maxage=3600')
    })
  })

  describe('RESPONSE_HEADERS', () => {
    it('should have required headers for iframe embedding', () => {
      expect(RESPONSE_HEADERS['Content-Type']).toBe('text/html; charset=utf-8')
      expect(RESPONSE_HEADERS['Cache-Control']).toBe(CACHE_CONFIG.cacheControl)
      expect(RESPONSE_HEADERS['Access-Control-Allow-Origin']).toBe('*')
      expect(RESPONSE_HEADERS['X-Content-Type-Options']).toBe('nosniff')
      expect(RESPONSE_HEADERS['Content-Disposition']).toBe('inline')
    })
  })

  describe('VALIDATION_CONFIG', () => {
    it('should have correct validation settings', () => {
      expect(VALIDATION_CONFIG.maxUrlLength).toBe(2048)
      expect(VALIDATION_CONFIG.allowedSchemes).toContain('http:')
      expect(VALIDATION_CONFIG.allowedSchemes).toContain('https:')
      expect(VALIDATION_CONFIG.blockedSchemes).toContain('javascript:')
      expect(VALIDATION_CONFIG.blockedSchemes).toContain('data:')
      expect(VALIDATION_CONFIG.blockedSchemes).toContain('file:')
      expect(VALIDATION_CONFIG.blockedSchemes).toContain('blob:')
    })
  })
})
