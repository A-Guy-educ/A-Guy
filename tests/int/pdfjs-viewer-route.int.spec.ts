import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/pdfjs-viewer/route'
import { clearTemplateCache } from '@/lib/pdfjs/template-loader'
import { VALID_ANNOTATION_MODES } from '@/lib/pdfjs/config'

describe('PDF.js Viewer Route Integration', () => {
  const mockViewerHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="viewer.css">
  <script src="viewer.mjs" type="module"></script>
  <script src="../build/pdf.mjs" type="module"></script>
  <link rel="resource" type="application/l10n" href="https://mozilla.github.io/pdf.js/web/locale/locale.json" />
</head>
<body>
  <div id="viewer"></div>
</body>
</html>
  `.trim()

  const mockViewerCss = `
.test { background: url(images/test.svg); }
  `.trim()

  const testOrigin = 'https://example.com'

  beforeEach(() => {
    // Clear template cache before each test
    clearTemplateCache()

    // Mock global fetch
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Happy path', () => {
    beforeEach(() => {
      // Mock successful CDN fetches
      ;(global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('viewer') && url.endsWith('.html')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(mockViewerHtml),
          })
        }
        if (url.includes('viewer') && url.endsWith('.css')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(mockViewerCss),
          })
        }
        return Promise.resolve({ ok: false, status: 404 })
      })
    })

    it('should return 200 with HTML content for valid file parameter', async () => {
      const request = new NextRequest(
        new URL(`${testOrigin}/api/pdfjs-viewer?file=/media/sample.pdf`),
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toContain('text/html')
      expect(response.headers.get('Cache-Control')).toBeDefined()
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(response.headers.get('Content-Disposition')).toBe('inline')

      const html = await response.text()
      expect(html).toBeDefined()
      expect(html.length).toBeGreaterThan(0)
    })

    it('should rewrite HTML with CDN URLs', async () => {
      const request = new NextRequest(
        new URL(`${testOrigin}/api/pdfjs-viewer?file=/media/sample.pdf`),
      )

      const response = await GET(request)
      const html = await response.text()

      // Check that CDN base is present
      expect(html).toContain('.blob.vercel-storage.com')

      // Check that viewer.mjs was replaced
      expect(html).not.toMatch(/src="viewer\.mjs"/)

      // Check that base href was added
      expect(html).toContain('<base href="')

      // Check that CSS was inlined
      expect(html).toContain('<style>')
    })

    it('should inject file URL for PDF loading', async () => {
      const testFileUrl = '/media/test.pdf'
      const request = new NextRequest(
        new URL(`${testOrigin}/api/pdfjs-viewer?file=${encodeURIComponent(testFileUrl)}`),
      )

      const response = await GET(request)
      const html = await response.text()

      // Check that file URL is present in the HTML (URL-encoded in the script)
      // The validator converts it to absolute URL: https://example.com/media/test.pdf
      const expectedAbsoluteUrl = `${testOrigin}${testFileUrl}`
      expect(html).toContain(encodeURIComponent(expectedAbsoluteUrl))
    })

    it('should handle relative file URLs', async () => {
      const request = new NextRequest(
        new URL(`${testOrigin}/api/pdfjs-viewer?file=media/sample.pdf`),
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      const html = await response.text()
      // File URL is converted to absolute and URL-encoded
      expect(html).toContain(encodeURIComponent(`${testOrigin}/media/sample.pdf`))
    })

    it('should handle absolute same-origin URLs', async () => {
      const request = new NextRequest(
        new URL(
          `${testOrigin}/api/pdfjs-viewer?file=${encodeURIComponent(`${testOrigin}/media/sample.pdf`)}`,
        ),
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
    })

    it('should accept Vercel Blob URLs', async () => {
      const blobUrl = 'https://test.blob.vercel-storage.com/file.pdf'
      const request = new NextRequest(
        new URL(`${testOrigin}/api/pdfjs-viewer?file=${encodeURIComponent(blobUrl)}`),
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
    })

    it('should inject annotationEditorMode parameter when provided', async () => {
      const testFileUrl = '/media/test.pdf'
      const request = new NextRequest(
        new URL(
          `${testOrigin}/api/pdfjs-viewer?file=${encodeURIComponent(testFileUrl)}&annotationEditorMode=13`,
        ),
      )

      const response = await GET(request)
      const html = await response.text()

      // Check that annotationEditorMode is present in the injected query string
      expect(html).toContain('annotationEditorMode=13')
    })

    it('should work without annotationEditorMode parameter', async () => {
      const testFileUrl = '/media/test.pdf'
      const request = new NextRequest(
        new URL(`${testOrigin}/api/pdfjs-viewer?file=${encodeURIComponent(testFileUrl)}`),
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      const html = await response.text()
      // Should not contain annotationEditorMode if not provided
      expect(html).not.toContain('annotationEditorMode')
    })

    it('should reject invalid annotationEditorMode values', async () => {
      const testFileUrl = '/media/test.pdf'
      const request = new NextRequest(
        new URL(
          `${testOrigin}/api/pdfjs-viewer?file=${encodeURIComponent(testFileUrl)}&annotationEditorMode=999`,
        ),
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      const html = await response.text()
      // Invalid mode should be ignored (not injected)
      expect(html).not.toContain('annotationEditorMode')
    })

    it('should accept valid annotationEditorMode values', async () => {
      const testFileUrl = '/media/test.pdf'

      // Use shared constant to ensure consistency
      for (const mode of VALID_ANNOTATION_MODES) {
        const request = new NextRequest(
          new URL(
            `${testOrigin}/api/pdfjs-viewer?file=${encodeURIComponent(testFileUrl)}&annotationEditorMode=${mode}`,
          ),
        )

        const response = await GET(request)
        const html = await response.text()

        expect(response.status).toBe(200)
        expect(html).toContain(`annotationEditorMode=${mode}`)
      }
    })
  })

  describe('Invalid input handling', () => {
    beforeEach(() => {
      // Mock successful CDN fetches (won't be called for invalid input)
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockViewerHtml),
      })
    })

    it('should return 400 for missing file parameter', async () => {
      const request = new NextRequest(new URL(`${testOrigin}/api/pdfjs-viewer`))

      const response = await GET(request)

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Invalid file URL')
      expect(json.details).toContain('Missing file parameter')
    })

    it('should return 400 for javascript: scheme', async () => {
      const request = new NextRequest(
        new URL(`${testOrigin}/api/pdfjs-viewer?file=javascript:alert(1)`),
      )

      const response = await GET(request)

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Invalid file URL')
      expect(json.details).toContain('scheme')
    })

    it('should return 400 for data: scheme', async () => {
      const request = new NextRequest(
        new URL(`${testOrigin}/api/pdfjs-viewer?file=data:text/html,<script>alert(1)</script>`),
      )

      const response = await GET(request)

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Invalid file URL')
    })

    it('should return 400 for file: scheme', async () => {
      const request = new NextRequest(
        new URL(`${testOrigin}/api/pdfjs-viewer?file=file:///etc/passwd`),
      )

      const response = await GET(request)

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Invalid file URL')
    })

    it('should return 400 for blob: scheme', async () => {
      const request = new NextRequest(
        new URL(`${testOrigin}/api/pdfjs-viewer?file=blob:https://example.com/123`),
      )

      const response = await GET(request)

      expect(response.status).toBe(400)
    })

    it('should return 400 for external origins', async () => {
      const request = new NextRequest(
        new URL(
          `${testOrigin}/api/pdfjs-viewer?file=${encodeURIComponent('https://evil.com/malicious.pdf')}`,
        ),
      )

      const response = await GET(request)

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Invalid file URL')
      expect(json.details).toContain('origin')
    })

    it('should return 400 for overly long URLs', async () => {
      const longPath = '/media/' + 'a'.repeat(3000) + '.pdf'
      const request = new NextRequest(
        new URL(`${testOrigin}/api/pdfjs-viewer?file=${encodeURIComponent(longPath)}`),
      )

      const response = await GET(request)

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Invalid file URL')
      expect(json.details).toContain('length')
    })
  })

  describe('Upstream failure handling', () => {
    it('should return 502 when viewer HTML fetch fails', async () => {
      // Mock failed HTML fetch
      ;(global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('viewer') && url.endsWith('.html')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
          })
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(mockViewerCss),
        })
      })

      const request = new NextRequest(
        new URL(`${testOrigin}/api/pdfjs-viewer?file=/media/sample.pdf`),
      )

      const response = await GET(request)

      expect(response.status).toBe(502)
      const json = await response.json()
      expect(json.error).toBe('PDF viewer upstream unavailable')
    })

    it('should return 502 when viewer CSS fetch fails', async () => {
      // Mock failed CSS fetch
      ;(global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('viewer') && url.endsWith('.html')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(mockViewerHtml),
          })
        }
        if (url.includes('viewer') && url.endsWith('.css')) {
          return Promise.resolve({
            ok: false,
            status: 404,
            statusText: 'Not Found',
          })
        }
        return Promise.resolve({ ok: false })
      })

      const request = new NextRequest(
        new URL(`${testOrigin}/api/pdfjs-viewer?file=/media/sample.pdf`),
      )

      const response = await GET(request)

      expect(response.status).toBe(502)
      const json = await response.json()
      expect(json.error).toBe('PDF viewer upstream unavailable')
    })

    it('should return 502 on fetch network error', async () => {
      // Mock network error
      ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

      const request = new NextRequest(
        new URL(`${testOrigin}/api/pdfjs-viewer?file=/media/sample.pdf`),
      )

      const response = await GET(request)

      // Network errors are treated as upstream unavailability
      expect(response.status).toBe(502)
      const json = await response.json()
      expect(json.error).toBe('PDF viewer upstream unavailable')
    })
  })

  describe('Caching behavior', () => {
    it('should use cached template on second request', async () => {
      const fetchSpy = vi.fn()
      ;(global.fetch as any).mockImplementation((url: string) => {
        fetchSpy(url)
        if (url.includes('viewer') && url.endsWith('.html')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(mockViewerHtml),
          })
        }
        if (url.includes('viewer') && url.endsWith('.css')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(mockViewerCss),
          })
        }
        return Promise.resolve({ ok: false })
      })

      const request1 = new NextRequest(
        new URL(`${testOrigin}/api/pdfjs-viewer?file=/media/sample.pdf`),
      )
      await GET(request1)

      const firstCallCount = fetchSpy.mock.calls.length

      const request2 = new NextRequest(
        new URL(`${testOrigin}/api/pdfjs-viewer?file=/media/other.pdf`),
      )
      await GET(request2)

      const secondCallCount = fetchSpy.mock.calls.length

      // Second request should not fetch again (uses cache)
      expect(secondCallCount).toBe(firstCallCount)
    })
  })
})
