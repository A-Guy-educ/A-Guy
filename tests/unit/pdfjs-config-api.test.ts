import { renderViewerHtml } from '@/infra/pdfjs/renderer'
import { describe, expect, it, vi } from 'vitest'

// Mock the vercel-blob-adapter module
vi.mock('@/infra/blob/vercel-blob-adapter', () => ({
  getBlobStoreUrl: vi.fn(),
}))

// Test constants
const TEST_CDN_BASE = 'https://example.blob.vercel-storage.com/pdfjs/4.4.168'
const TEST_VIEWER_URLS = {
  html: `${TEST_CDN_BASE}/viewer-I6DnqEMX9W9cwNNvWKm3D8YvXdCzUA.html`,
  mjs: `${TEST_CDN_BASE}/viewer-SyYgQ0jufpmBIqrWX2zGA21kZmurH6.mjs`,
  css: `${TEST_CDN_BASE}/viewer-MgMiA2nNdPgVwb4uc8CAB6Twx6vmUC.css`,
  pdfMjs: `${TEST_CDN_BASE}/build/pdf.mjs`,
  pdfWorkerMjs: `${TEST_CDN_BASE}/build/pdf.worker.mjs`,
}

describe('PDF.js configuration injection - CORRECT API', () => {
  const mockHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="viewer.css">
  <script src="viewer.mjs" type="module"></script>
  <script src="../build/pdf.mjs" type="module"></script>
</head>
<body>
  <div id="viewer"></div>
</body>
</html>
  `.trim()

  const mockCss = `
    .test { background: url(images/test.svg); }
  `

  it('should inject webviewerloaded event listener to set disableRange via PDFViewerApplicationOptions', async () => {
    const result = await renderViewerHtml(mockHtml, mockCss, TEST_CDN_BASE, TEST_VIEWER_URLS)
    // The correct API uses PDFViewerApplicationOptions.set(), not window.PDFJS_GLOBAL_OPTS
    expect(result).toContain('PDFViewerApplicationOptions.set')
    expect(result).toContain('disableRange')
    expect(result).toContain('disableStream')
    // Should NOT use the broken approach
    expect(result).not.toContain('PDFJS_GLOBAL_OPTS')
  })

  it('should use document.addEventListener webviewerloaded pattern', async () => {
    const result = await renderViewerHtml(mockHtml, mockCss, TEST_CDN_BASE, TEST_VIEWER_URLS)
    // The correct approach uses webviewerloaded event listener
    expect(result).toContain('addEventListener')
    expect(result).toContain('webviewerloaded')
  })

  it('should inject error reporting via postMessage when PDF load fails', async () => {
    const result = await renderViewerHtml(mockHtml, mockCss, TEST_CDN_BASE, TEST_VIEWER_URLS)
    // The renderer should inject code to postMessage errors to parent window
    expect(result).toContain('postMessage')
    expect(result).toContain('pdf-load-error')
  })

  it('should set disablePreferences to prevent preference overrides', async () => {
    const result = await renderViewerHtml(mockHtml, mockCss, TEST_CDN_BASE, TEST_VIEWER_URLS)
    // Setting disablePreferences ensures our options aren't overridden by user preferences
    expect(result).toContain('disablePreferences')
  })

  it('should inject config script before viewer.mjs to ensure proper initialization order', async () => {
    const result = await renderViewerHtml(mockHtml, mockCss, TEST_CDN_BASE, TEST_VIEWER_URLS)
    // The webviewerloaded listener must be injected BEFORE viewer.mjs loads
    const webviewerloadedIndex = result.indexOf('webviewerloaded')
    const viewerMjsIndex = result.indexOf(`src="${TEST_VIEWER_URLS.mjs}"`)
    expect(webviewerloadedIndex).toBeGreaterThan(0)
    expect(viewerMjsIndex).toBeGreaterThan(0)
    // The listener should come BEFORE the viewer script
    expect(webviewerloadedIndex).toBeLessThan(viewerMjsIndex)
  })

  it('should use PDFViewerApplicationOptions.set() with correct syntax', async () => {
    const result = await renderViewerHtml(mockHtml, mockCss, TEST_CDN_BASE, TEST_VIEWER_URLS)
    // The correct syntax is PDFViewerApplicationOptions.set("key", value)
    expect(result).toContain('PDFViewerApplicationOptions.set("disableRange"')
    expect(result).toContain('PDFViewerApplicationOptions.set("disableStream"')
  })

  it('should check window.parent before posting message to avoid errors in top-level frame', async () => {
    const result = await renderViewerHtml(mockHtml, mockCss, TEST_CDN_BASE, TEST_VIEWER_URLS)
    // Should check window.parent !== window before posting to avoid errors
    expect(result).toContain('window.parent')
  })
})
