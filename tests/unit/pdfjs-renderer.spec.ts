import { describe, it, expect } from 'vitest'
import { rewriteCss, renderViewerHtml, validateRewrittenHtml } from '@/lib/pdfjs/renderer'
import { CDN_BASE, VIEWER_URLS } from '@/lib/pdfjs/config'

describe('rewriteCss', () => {
  it('should rewrite relative image paths to absolute CDN URLs', () => {
    const css = `
      .icon { background: url(images/icon.svg); }
      .logo { background: url(images/logo.png); }
    `
    const rewritten = rewriteCss(css)

    expect(rewritten).toContain(`url(${CDN_BASE}/web/images/icon.svg)`)
    expect(rewritten).toContain(`url(${CDN_BASE}/web/images/logo.png)`)
    expect(rewritten).not.toContain('url(images/')
  })

  it('should handle multiple images on same line', () => {
    const css = '.icons { background: url(images/a.svg), url(images/b.svg); }'
    const rewritten = rewriteCss(css)

    expect(rewritten).toContain(`url(${CDN_BASE}/web/images/a.svg)`)
    expect(rewritten).toContain(`url(${CDN_BASE}/web/images/b.svg)`)
  })

  it('should not modify absolute URLs', () => {
    const css = '.external { background: url(https://example.com/image.png); }'
    const rewritten = rewriteCss(css)

    expect(rewritten).toContain('url(https://example.com/image.png)')
  })

  it('should handle empty CSS', () => {
    const rewritten = rewriteCss('')
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
    const rewritten = rewriteCss(css)

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

  it('should add base href after <head>', () => {
    const result = renderViewerHtml(mockHtml, mockCss)
    expect(result).toContain(`<head>\n  <base href="${CDN_BASE}/web/">`)
  })

  it('should replace viewer.mjs with CDN URL', () => {
    const result = renderViewerHtml(mockHtml, mockCss)
    expect(result).toContain(`src="${VIEWER_URLS.mjs}"`)
    expect(result).not.toMatch(/src="viewer\.mjs"/)
  })

  it('should replace relative pdf.mjs path', () => {
    const result = renderViewerHtml(mockHtml, mockCss)
    expect(result).toContain(`src="${VIEWER_URLS.pdfMjs}"`)
    expect(result).not.toMatch(/src="\.\.\/build\/pdf\.mjs"/)
  })

  it('should replace Mozilla CDN pdf.mjs reference', () => {
    const htmlWithMozilla = mockHtml.replace(
      'src="../build/pdf.mjs"',
      'src="https://mozilla.github.io/pdf.js/build/pdf.mjs"',
    )
    const result = renderViewerHtml(htmlWithMozilla, mockCss)
    expect(result).toContain(`src="${VIEWER_URLS.pdfMjs}"`)
    expect(result).not.toContain('src="https://mozilla.github.io/pdf.js/build/pdf.mjs"')
  })

  it('should remove Mozilla locale references', () => {
    const result = renderViewerHtml(mockHtml, mockCss)
    expect(result).not.toContain('https://mozilla.github.io/pdf.js/web/locale/locale.json')
  })

  it('should remove local locale references', () => {
    const result = renderViewerHtml(mockHtml, mockCss)
    expect(result).not.toContain('href="locale/locale.json"')
  })

  it('should inline CSS with rewritten paths', () => {
    // First rewrite CSS, then pass to renderViewerHtml (as the route does)
    const rewrittenCss = rewriteCss(mockCss)
    const result = renderViewerHtml(mockHtml, rewrittenCss)
    expect(result).toContain('<style>')
    expect(result).toContain(`url(${CDN_BASE}/web/images/test.svg)`)
  })

  it('should remove external CSS link', () => {
    const result = renderViewerHtml(mockHtml, mockCss)
    expect(result).toContain('href="data:text/css;base64,REMOVED"')
  })

  it('should preserve HTML structure', () => {
    const result = renderViewerHtml(mockHtml, mockCss)
    expect(result).toContain('<!DOCTYPE html>')
    expect(result).toContain('<html>')
    expect(result).toContain('<body>')
    expect(result).toContain('<div id="viewer"></div>')
    expect(result).toContain('</html>')
  })

  it('should handle HTML without locale references', () => {
    const simpleHtml = `
<html>
<head>
  <script src="viewer.mjs"></script>
</head>
<body></body>
</html>
    `.trim()
    const result = renderViewerHtml(simpleHtml, '')
    expect(result).toContain(`<base href="${CDN_BASE}/web/">`)
  })
})

describe('validateRewrittenHtml', () => {
  const validHtml = `
<!DOCTYPE html>
<html>
<head>
  <base href="${CDN_BASE}/web/">
  <link rel="stylesheet" href="data:text/css;base64,REMOVED">
  <script src="${VIEWER_URLS.mjs}" type="module"></script>
  <script src="${VIEWER_URLS.pdfMjs}" type="module"></script>
  <style>.test { color: red; }</style>
</head>
<body></body>
</html>
  `.trim()

  it('should validate correct HTML as valid', () => {
    const result = validateRewrittenHtml(validHtml)
    expect(result.valid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('should detect missing base href', () => {
    const html = validHtml.replace(`<base href="${CDN_BASE}/web/">`, '')
    const result = validateRewrittenHtml(html)
    expect(result.valid).toBe(false)
    expect(result.issues).toContain('base href not added')
  })

  it('should detect unreplaced viewer.mjs', () => {
    const html = validHtml.replace(`src="${VIEWER_URLS.mjs}"`, 'src="viewer.mjs"')
    const result = validateRewrittenHtml(html)
    expect(result.valid).toBe(false)
    expect(result.issues).toContain('viewer.mjs not replaced with CDN URL')
  })

  it('should detect unreplaced pdf.mjs references', () => {
    const html = validHtml.replace(`src="${VIEWER_URLS.pdfMjs}"`, 'src="../build/pdf.mjs"')
    const result = validateRewrittenHtml(html)
    expect(result.valid).toBe(false)
    expect(result.issues).toContain('pdf.mjs references not replaced with CDN URL')
  })

  it('should detect missing inline CSS', () => {
    const html = validHtml.replace('<style>.test { color: red; }</style>', '')
    const result = validateRewrittenHtml(html)
    expect(result.valid).toBe(false)
    expect(result.issues).toContain('CSS not inlined correctly')
  })

  it('should detect remaining external CSS link', () => {
    const html = validHtml
      .replace('href="data:text/css;base64,REMOVED"', 'href="viewer.css"')
      .replace('<style>.test { color: red; }</style>', '')
    const result = validateRewrittenHtml(html)
    expect(result.valid).toBe(false)
    expect(result.issues).toContain('CSS not inlined correctly')
  })

  it('should detect multiple issues', () => {
    const html = `
<html>
<head>
  <script src="viewer.mjs"></script>
  <script src="../build/pdf.mjs"></script>
</head>
<body></body>
</html>
    `.trim()
    const result = validateRewrittenHtml(html)
    expect(result.valid).toBe(false)
    expect(result.issues.length).toBeGreaterThan(1)
    expect(result.issues).toContain('base href not added')
    expect(result.issues).toContain('viewer.mjs not replaced with CDN URL')
    expect(result.issues).toContain('pdf.mjs references not replaced with CDN URL')
    expect(result.issues).toContain('CSS not inlined correctly')
  })

  it('should handle edge case with Mozilla CDN reference', () => {
    const html = validHtml.replace(
      `src="${VIEWER_URLS.pdfMjs}"`,
      'src="https://mozilla.github.io/pdf.js/build/pdf.mjs"',
    )
    const result = validateRewrittenHtml(html)
    expect(result.valid).toBe(false)
    expect(result.issues).toContain('pdf.mjs references not replaced with CDN URL')
  })
})
