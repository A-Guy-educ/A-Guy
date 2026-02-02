import { renderViewerHtml, rewriteCss, validateRewrittenHtml } from '@/infra/pdfjs/renderer'
import { describe, expect, it, vi } from 'vitest'

// Mock the vercel-blob-adapter module
vi.mock('@/infra/blob/vercel-blob-adapter', () => ({
  getExternalStorageUrl: vi.fn(),
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

describe('rewriteCss', () => {
  it('should rewrite relative image paths to absolute CDN URLs', () => {
    const css = `
      .icon { background: url(images/icon.svg); }
      .logo { background: url(images/logo.png); }
    `
    const rewritten = rewriteCss(css, TEST_CDN_BASE)

    expect(rewritten).toContain(`url(${TEST_CDN_BASE}/web/images/icon.svg)`)
    expect(rewritten).toContain(`url(${TEST_CDN_BASE}/web/images/logo.png)`)
    expect(rewritten).not.toContain('url(images/')
  })

  it('should handle multiple images on same line', () => {
    const css = '.icons { background: url(images/a.svg), url(images/b.svg); }'
    const rewritten = rewriteCss(css, TEST_CDN_BASE)

    expect(rewritten).toContain(`url(${TEST_CDN_BASE}/web/images/a.svg)`)
    expect(rewritten).toContain(`url(${TEST_CDN_BASE}/web/images/b.svg)`)
  })

  it('should not modify absolute URLs', () => {
    const css = '.external { background: url(https://example.com/image.png); }'
    const rewritten = rewriteCss(css, TEST_CDN_BASE)

    expect(rewritten).toContain('url(https://example.com/image.png)')
  })

  it('should handle empty CSS', () => {
    const rewritten = rewriteCss('', TEST_CDN_BASE)
    expect(rewritten).toBe('')
  })

  it('should preserve CSS structure', () => {
    const css = `
      /* Comment */
      .class {
        property: value;
        background: url(images/test.svg);
      }
    `
    const rewritten = rewriteCss(css, TEST_CDN_BASE)

    expect(rewritten).toContain('/* Comment */')
    expect(rewritten).toContain('.class {')
    expect(rewritten).toContain('property: value;')
  })
})

describe('renderViewerHtml', () => {
  const mockHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="viewer.css">
  <script src="viewer.mjs" type="module"></script>
  <script src="../build/pdf.mjs" type="module"></script>
  <link rel="resource" type="application/l10n" href="https://mozilla.github.io/pdf.js/web/locale/locale.json" />
  <link rel="resource" type="application/l10n" href="locale/locale.json">
</head>
<body>
  <div id="viewer"></div>
</body>
</html>
  `.trim()

  const mockCss = `
    .test { background: url(images/test.svg); }
  `

  it('should add base href after <head>', async () => {
    const result = await renderViewerHtml(mockHtml, mockCss, TEST_CDN_BASE, TEST_VIEWER_URLS)
    expect(result).toContain(`<head>\n  <base href="${TEST_CDN_BASE}/web/">`)
  })

  it('should replace viewer.mjs with CDN URL', async () => {
    const result = await renderViewerHtml(mockHtml, mockCss, TEST_CDN_BASE, TEST_VIEWER_URLS)
    expect(result).toContain(`src="${TEST_VIEWER_URLS.mjs}"`)
    expect(result).not.toMatch(/src="viewer\.mjs"/)
  })

  it('should replace relative pdf.mjs path', async () => {
    const result = await renderViewerHtml(mockHtml, mockCss, TEST_CDN_BASE, TEST_VIEWER_URLS)
    expect(result).toContain(`src="${TEST_VIEWER_URLS.pdfMjs}"`)
    expect(result).not.toMatch(/src="\.\.\/build\/pdf\.mjs"/)
  })

  it('should replace Mozilla CDN pdf.mjs reference', async () => {
    const htmlWithMozilla = mockHtml.replace(
      'src="../build/pdf.mjs"',
      'src="https://mozilla.github.io/pdf.js/build/pdf.mjs"',
    )
    const result = await renderViewerHtml(htmlWithMozilla, mockCss, TEST_CDN_BASE, TEST_VIEWER_URLS)
    expect(result).toContain(`src="${TEST_VIEWER_URLS.pdfMjs}"`)
    expect(result).not.toContain('src="https://mozilla.github.io/pdf.js/build/pdf.mjs"')
  })

  it('should remove Mozilla locale references', async () => {
    const result = await renderViewerHtml(mockHtml, mockCss, TEST_CDN_BASE, TEST_VIEWER_URLS)
    expect(result).not.toContain('https://mozilla.github.io/pdf.js/web/locale/locale.json')
  })

  it('should remove local locale references', async () => {
    const result = await renderViewerHtml(mockHtml, mockCss, TEST_CDN_BASE, TEST_VIEWER_URLS)
    expect(result).not.toContain('href="locale/locale.json"')
  })

  it('should inline CSS with rewritten paths', async () => {
    const rewrittenCss = rewriteCss(mockCss, TEST_CDN_BASE)
    const result = await renderViewerHtml(mockHtml, rewrittenCss, TEST_CDN_BASE, TEST_VIEWER_URLS)
    expect(result).toContain('<style>')
    expect(result).toContain(`url(${TEST_CDN_BASE}/web/images/test.svg)`)
  })

  it('should remove external CSS link', async () => {
    const result = await renderViewerHtml(mockHtml, mockCss, TEST_CDN_BASE, TEST_VIEWER_URLS)
    expect(result).toContain('href="data:text/css;base64,REMOVED"')
  })

  it('should preserve HTML structure', async () => {
    const result = await renderViewerHtml(mockHtml, mockCss, TEST_CDN_BASE, TEST_VIEWER_URLS)
    expect(result).toContain('<!DOCTYPE html>')
    expect(result).toContain('<html>')
    expect(result).toContain('<body>')
    expect(result).toContain('<div id="viewer"></div>')
    expect(result).toContain('</html>')
  })

  it('should handle HTML without locale references', async () => {
    const simpleHtml = `
<html>
<head>
  <script src="viewer.mjs"></script>
</head>
<body></body>
</html>
    `.trim()
    const result = await renderViewerHtml(simpleHtml, '', TEST_CDN_BASE, TEST_VIEWER_URLS)
    expect(result).toContain(`<base href="${TEST_CDN_BASE}/web/">`)
  })
})

describe('validateRewrittenHtml', () => {
  const validHtml = `
<!DOCTYPE html>
<html>
<head>
  <base href="${TEST_CDN_BASE}/web/">
  <link rel="stylesheet" href="data:text/css;base64,REMOVED">
  <script src="${TEST_VIEWER_URLS.mjs}" type="module"></script>
  <script src="${TEST_VIEWER_URLS.pdfMjs}" type="module"></script>
  <style>.test { color: red; }</style>
</head>
<body></body>
</html>
  `.trim()

  it('should validate correct HTML as valid', async () => {
    const result = await validateRewrittenHtml(validHtml, TEST_CDN_BASE, TEST_VIEWER_URLS)
    expect(result.valid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('should detect missing base href', async () => {
    const html = validHtml.replace(`<base href="${TEST_CDN_BASE}/web/">`, '')
    const result = await validateRewrittenHtml(html, TEST_CDN_BASE, TEST_VIEWER_URLS)
    expect(result.valid).toBe(false)
    expect(result.issues).toContain('base href not added')
  })

  it('should detect unreplaced viewer.mjs', async () => {
    const html = validHtml.replace(`src="${TEST_VIEWER_URLS.mjs}"`, 'src="viewer.mjs"')
    const result = await validateRewrittenHtml(html, TEST_CDN_BASE, TEST_VIEWER_URLS)
    expect(result.valid).toBe(false)
    expect(result.issues).toContain('viewer.mjs not replaced with CDN URL')
  })

  it('should detect unreplaced pdf.mjs references', async () => {
    const html = validHtml.replace(`src="${TEST_VIEWER_URLS.pdfMjs}"`, 'src="../build/pdf.mjs"')
    const result = await validateRewrittenHtml(html, TEST_CDN_BASE, TEST_VIEWER_URLS)
    expect(result.valid).toBe(false)
    expect(result.issues).toContain('pdf.mjs references not replaced with CDN URL')
  })

  it('should detect missing inline CSS', async () => {
    const html = validHtml.replace('<style>.test { color: red; }</style>', '')
    const result = await validateRewrittenHtml(html, TEST_CDN_BASE, TEST_VIEWER_URLS)
    expect(result.valid).toBe(false)
    expect(result.issues).toContain('CSS not inlined correctly')
  })

  it('should detect remaining external CSS link', async () => {
    const html = validHtml
      .replace('href="data:text/css;base64,REMOVED"', 'href="viewer.css"')
      .replace('<style>.test { color: red; }</style>', '')
    const result = await validateRewrittenHtml(html, TEST_CDN_BASE, TEST_VIEWER_URLS)
    expect(result.valid).toBe(false)
    expect(result.issues).toContain('CSS not inlined correctly')
  })

  it('should detect multiple issues', async () => {
    const html = `
<html>
<head>
  <script src="viewer.mjs"></script>
  <script src="../build/pdf.mjs"></script>
</head>
<body></body>
</html>
    `.trim()
    const result = await validateRewrittenHtml(html, TEST_CDN_BASE, TEST_VIEWER_URLS)
    expect(result.valid).toBe(false)
    expect(result.issues.length).toBeGreaterThan(1)
    expect(result.issues).toContain('base href not added')
    expect(result.issues).toContain('viewer.mjs not replaced with CDN URL')
    expect(result.issues).toContain('pdf.mjs references not replaced with CDN URL')
    expect(result.issues).toContain('CSS not inlined correctly')
  })

  it('should handle edge case with Mozilla CDN reference', async () => {
    const html = validHtml.replace(
      `src="${TEST_VIEWER_URLS.pdfMjs}"`,
      'src="https://mozilla.github.io/pdf.js/build/pdf.mjs"',
    )
    const result = await validateRewrittenHtml(html, TEST_CDN_BASE, TEST_VIEWER_URLS)
    expect(result.valid).toBe(false)
    expect(result.issues).toContain('pdf.mjs references not replaced with CDN URL')
  })
})
