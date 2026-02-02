import { renderViewerHtml, rewriteCss } from '@/infra/pdfjs/renderer'
import { describe, expect, it } from 'vitest'

// Test constants
const TEST_CDN_BASE = 'https://example.blob.vercel-storage.com/pdfjs/4.4.168'
const TEST_VIEWER_URLS = {
  html: `${TEST_CDN_BASE}/viewer-I6DnqEMX9W9cwNNvWKm3D8YvXdCzUA.html`,
  mjs: `${TEST_CDN_BASE}/viewer-SyYgQ0jufpmBIqrWX2zGA21kZmurH6.mjs`,
  css: `${TEST_CDN_BASE}/viewer-MgMiA2nNdPgVwb4uc8CAB6Twx6vmUC.css`,
  pdfMjs: `${TEST_CDN_BASE}/build/pdf.mjs`,
  pdfWorkerMjs: `${TEST_CDN_BASE}/build/pdf.worker.mjs`,
}

describe('PDF.js Security Features', () => {
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

  const mockCss = '.test { color: red; }'

  describe('Download and Print Controls', () => {
    it('should hide download button with CSS', async () => {
      const rewrittenCss = rewriteCss(mockCss, TEST_CDN_BASE)
      const result = await renderViewerHtml(mockHtml, rewrittenCss, TEST_CDN_BASE, TEST_VIEWER_URLS)

      expect(result).toContain('#download,')
      expect(result).toContain('#downloadButton,')
      expect(result).toContain('display: none !important')
      expect(result).toContain('visibility: hidden !important')
      expect(result).toContain('pointer-events: none !important')
    })

    it('should hide print button with CSS', async () => {
      const rewrittenCss = rewriteCss(mockCss, TEST_CDN_BASE)
      const result = await renderViewerHtml(mockHtml, rewrittenCss, TEST_CDN_BASE, TEST_VIEWER_URLS)

      expect(result).toContain('#print,')
      expect(result).toContain('#printButton,')
    })

    it('should hide secondary download and print buttons', async () => {
      const rewrittenCss = rewriteCss(mockCss, TEST_CDN_BASE)
      const result = await renderViewerHtml(mockHtml, rewrittenCss, TEST_CDN_BASE, TEST_VIEWER_URLS)

      expect(result).toContain('#secondaryDownload,')
      expect(result).toContain('#secondaryPrint')
    })

    it('should hide open file button', async () => {
      const rewrittenCss = rewriteCss(mockCss, TEST_CDN_BASE)
      const result = await renderViewerHtml(mockHtml, rewrittenCss, TEST_CDN_BASE, TEST_VIEWER_URLS)

      expect(result).toContain('#openFile,')
      expect(result).toContain('#secondaryOpenFile,')
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('should disable Ctrl+P and Cmd+P keyboard shortcuts', async () => {
      const rewrittenCss = rewriteCss(mockCss, TEST_CDN_BASE)
      const result = await renderViewerHtml(mockHtml, rewrittenCss, TEST_CDN_BASE, TEST_VIEWER_URLS)

      expect(result).toContain('Prevent printing via keyboard shortcuts')
      expect(result).toContain("(e.ctrlKey || e.metaKey) && e.key === 'p'")
      expect(result).toContain('e.preventDefault()')
      expect(result).toContain('e.stopPropagation()')
      expect(result).toContain('e.stopImmediatePropagation()')
    })

    it('should use capture phase for keyboard event listener', async () => {
      const rewrittenCss = rewriteCss(mockCss, TEST_CDN_BASE)
      const result = await renderViewerHtml(mockHtml, rewrittenCss, TEST_CDN_BASE, TEST_VIEWER_URLS)

      // The third parameter 'true' means capture phase
      expect(result).toContain("addEventListener('keydown', function(e)")
      expect(result).toContain(', true);')
    })
  })

  describe('Window.print Override', () => {
    it('should override window.print function', async () => {
      const rewrittenCss = rewriteCss(mockCss, TEST_CDN_BASE)
      const result = await renderViewerHtml(mockHtml, rewrittenCss, TEST_CDN_BASE, TEST_VIEWER_URLS)

      expect(result).toContain('window.print = function()')
      expect(result).toContain('Printing is disabled for this document')
    })
  })

  describe('Context Menu', () => {
    it('should disable context menu to prevent right-click print', async () => {
      const rewrittenCss = rewriteCss(mockCss, TEST_CDN_BASE)
      const result = await renderViewerHtml(mockHtml, rewrittenCss, TEST_CDN_BASE, TEST_VIEWER_URLS)

      expect(result).toContain("addEventListener('contextmenu'")
      expect(result).toContain('e.preventDefault()')
    })
  })

  describe('PDF Viewing', () => {
    it('should still render PDF content correctly', async () => {
      const rewrittenCss = rewriteCss(mockCss, TEST_CDN_BASE)
      const result = await renderViewerHtml(mockHtml, rewrittenCss, TEST_CDN_BASE, TEST_VIEWER_URLS)

      // Check that essential viewer elements are preserved
      expect(result).toContain('<div id="viewer"></div>')
      expect(result).toContain('<html>')
      expect(result).toContain('<!DOCTYPE html>')
    })

    it('should preserve viewer assets', async () => {
      const rewrittenCss = rewriteCss(mockCss, TEST_CDN_BASE)
      const result = await renderViewerHtml(mockHtml, rewrittenCss, TEST_CDN_BASE, TEST_VIEWER_URLS)

      // Check that viewer scripts are still present
      expect(result).toContain('.blob.vercel-storage.com')
    })
  })
})
