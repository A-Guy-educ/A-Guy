// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { sanitizeHtml } from '../../../src/infra/utils/sanitize-html'

describe('sanitizeHtml — XSS prevention', () => {
  it('strips <script>alert(1)</script>', () => {
    const r = sanitizeHtml('<script>alert(1)</script>')
    expect(r).not.toContain('<script')
    expect(r).not.toContain('alert')
  })
  it('strips <img src=x onerror=alert(1)>', () => {
    expect(sanitizeHtml('<img src="x" onerror="alert(1)">')).not.toContain('onerror')
  })
  it('strips <a href="javascript:alert(1)">', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:')
  })
  it('strips inline onclick handler', () => {
    expect(sanitizeHtml('<div onclick="alert(1)">x</div>')).not.toContain('onclick')
  })
  it('strips <iframe>', () => {
    expect(sanitizeHtml('<iframe src="https://evil.com"></iframe>')).not.toContain('<iframe')
  })
  it('strips data: URI in href', () => {
    expect(sanitizeHtml('<a href="data:text/html,x">x</a>')).not.toContain('data:')
  })
  it('strips all on* handler variants', () => {
    for (const h of ['onload', 'onmouseover', 'onfocus', 'onblur']) {
      expect(sanitizeHtml(`<div ${h}="evil()">x</div>`)).not.toContain(h)
    }
  })
  it('strips foreignObject from SVG', () => {
    expect(sanitizeHtml('<svg><foreignObject><div>x</div></foreignObject></svg>')).not.toContain(
      'foreignObject',
    )
  })
  it('strips SVG use element', () => {
    expect(sanitizeHtml('<svg><use href="#icon"/></svg>')).not.toContain('<use')
  })
  it('strips href from non-<a> elements (hook enforcement)', () => {
    expect(sanitizeHtml('<div href="https://evil.com">x</div>')).not.toContain('href')
  })
})

describe('sanitizeHtml — safe content passthrough', () => {
  it('preserves paragraph text', () => {
    expect(sanitizeHtml('<p>Hello world</p>')).toContain('Hello world')
  })
  it('preserves <strong> formatting', () => {
    expect(sanitizeHtml('<strong>bold</strong>')).toContain('<strong>')
  })
  it('preserves lists', () => {
    expect(sanitizeHtml('<ul><li>Item 1</li></ul>')).toContain('<ul>')
  })
  it('preserves headings h1–h6', () => {
    for (let i = 1; i <= 6; i++) {
      expect(sanitizeHtml(`<h${i}>T</h${i}>`)).toContain(`<h${i}>`)
    }
  })
  it('preserves safe https anchor links', () => {
    const r = sanitizeHtml('<a href="https://example.com">link</a>')
    expect(r).toContain('<a')
    expect(r).toContain('href')
  })
  it('preserves images with safe src/alt', () => {
    const r = sanitizeHtml('<img src="https://example.com/img.jpg" alt="test">')
    expect(r).toContain('<img')
    expect(r).toContain('alt')
  })
  it('preserves data-* attributes', () => {
    expect(sanitizeHtml('<div data-id="123">x</div>')).toContain('data-id')
  })
  it('preserves table structure', () => {
    const r = sanitizeHtml(
      '<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>B</td></tr></tbody></table>',
    )
    expect(r).toContain('<table')
    expect(r).toContain('<th>')
    expect(r).toContain('<td>')
  })
  it('preserves safe SVG path', () => {
    const r = sanitizeHtml('<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>')
    expect(r).toContain('<svg')
    expect(r).toContain('<path')
  })
})

describe('sanitizeHtml — introDescription regression', () => {
  it('strips script tag from introDescription-style content', () => {
    const unsafe = '<p>Welcome!</p><script>steal(document.cookie)</script>'
    const r = sanitizeHtml(unsafe)
    expect(r).toContain('Welcome!')
    expect(r).not.toContain('<script')
  })
  it('strips img onerror from introDescription-style content', () => {
    const r = sanitizeHtml('<p>Instructions</p><img src=x onerror=alert(document.cookie)>')
    expect(r).toContain('Instructions')
    expect(r).not.toContain('onerror')
  })
  it('preserves legitimate introDescription HTML', () => {
    const r = sanitizeHtml('<p>Complete <strong>all</strong>:</p><ul><li>Ex 1</li></ul>')
    expect(r).toContain('<strong>')
    expect(r).toContain('<ul>')
  })
})
