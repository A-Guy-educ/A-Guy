import { describe, it, expect } from 'vitest'
import { renderViewerHtml, rewriteCss } from '@/lib/pdfjs/renderer'

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
    it('should hide download button with CSS', () => {
      const rewrittenCss = rewriteCss(mockCss)
      const result = renderViewerHtml(mockHtml, rewrittenCss)

      expect(result).toContain('#download,')
      expect(result).toContain('#downloadButton,')
      expect(result).toContain('display: none !important')
      expect(result).toContain('visibility: hidden !important')
      expect(result).toContain('pointer-events: none !important')
    })

    it('should hide print button with CSS', () => {
      const rewrittenCss = rewriteCss(mockCss)
      const result = renderViewerHtml(mockHtml, rewrittenCss)

      expect(result).toContain('#print,')
      expect(result).toContain('#printButton,')
    })

    it('should hide secondary download and print buttons', () => {
      const rewrittenCss = rewriteCss(mockCss)
      const result = renderViewerHtml(mockHtml, rewrittenCss)

      expect(result).toContain('#secondaryDownload,')
      expect(result).toContain('#secondaryPrint')
    })

    it('should hide open file button', () => {
      const rewrittenCss = rewriteCss(mockCss)
      const result = renderViewerHtml(mockHtml, rewrittenCss)

      expect(result).toContain('#openFile,')
      expect(result).toContain('#secondaryOpenFile,')
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('should disable Ctrl+P and Cmd+P keyboard shortcuts', () => {
      const rewrittenCss = rewriteCss(mockCss)
      const result = renderViewerHtml(mockHtml, rewrittenCss)

      expect(result).toContain('Prevent printing via keyboard shortcuts')
      expect(result).toContain("(e.ctrlKey || e.metaKey) && e.key === 'p'")
      expect(result).toContain('e.preventDefault()')
      expect(result).toContain('e.stopPropagation()')
      expect(result).toContain('e.stopImmediatePropagation()')
    })

    it('should use capture phase for keyboard event listener', () => {
      const rewrittenCss = rewriteCss(mockCss)
      const result = renderViewerHtml(mockHtml, rewrittenCss)

      // The third parameter 'true' means capture phase
      expect(result).toContain("addEventListener('keydown', function(e)")
      expect(result).toContain(', true);')
    })
  })

  describe('Window.print Override', () => {
    it('should override window.print function', () => {
      const rewrittenCss = rewriteCss(mockCss)
      const result = renderViewerHtml(mockHtml, rewrittenCss)

      expect(result).toContain('window.print = function()')
      expect(result).toContain('Printing is disabled for this document')
    })
  })

  describe('Context Menu', () => {
    it('should disable context menu to prevent right-click print', () => {
      const rewrittenCss = rewriteCss(mockCss)
      const result = renderViewerHtml(mockHtml, rewrittenCss)

      expect(result).toContain("addEventListener('contextmenu'")
      expect(result).toContain('e.preventDefault()')
    })
  })

  describe('PDF Viewing', () => {
    it('should still render PDF content correctly', () => {
      const rewrittenCss = rewriteCss(mockCss)
      const result = renderViewerHtml(mockHtml, rewrittenCss)

      // Check that essential viewer elements are preserved
      expect(result).toContain('<div id="viewer"></div>')
      expect(result).toContain('<html>')
      expect(result).toContain('<!DOCTYPE html>')
    })

    it('should preserve viewer assets', () => {
      const rewrittenCss = rewriteCss(mockCss)
      const result = renderViewerHtml(mockHtml, rewrittenCss)

      // Check that viewer scripts are still present
      expect(result).toContain('.blob.vercel-storage.com')
    })
  })
})
