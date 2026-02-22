/**
 * Unit test for HtmlRichTextField paste functionality
 * Verifies that pasted HTML is stored as real HTML tags, not escaped entities
 */
import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from '@/infra/utils/sanitize-html'

describe('HtmlRichTextField - HTML Paste Verification', () => {
  it('sanitizer allows required tags: h1-h6, p, strong/em/u, ul/ol/li, a', () => {
    const testHtml = `
      <h1>Heading 1</h1>
      <h2>Heading 2</h2>
      <h3>Heading 3</h3>
      <h4>Heading 4</h4>
      <h5>Heading 5</h5>
      <h6>Heading 6</h6>
      <p>Paragraph with <strong>bold</strong>, <em>italic</em>, and <u>underline</u></p>
      <ul>
        <li>Bullet item 1</li>
        <li>Bullet item 2</li>
      </ul>
      <ol>
        <li>Numbered item 1</li>
        <li>Numbered item 2</li>
      </ol>
      <p><a href="https://example.com">Link text</a></p>
    `

    const sanitized = sanitizeHtml(testHtml)

    // Verify all required tags are preserved
    expect(sanitized).toContain('<h1>')
    expect(sanitized).toContain('<h2>')
    expect(sanitized).toContain('<h3>')
    expect(sanitized).toContain('<h4>')
    expect(sanitized).toContain('<h5>')
    expect(sanitized).toContain('<h6>')
    expect(sanitized).toContain('<p>')
    expect(sanitized).toContain('<strong>')
    expect(sanitized).toContain('<em>')
    expect(sanitized).toContain('<u>')
    expect(sanitized).toContain('<ul>')
    expect(sanitized).toContain('<ol>')
    expect(sanitized).toContain('<li>')
    expect(sanitized).toContain('<a href="https://example.com">')

    // Verify tags are NOT escaped
    expect(sanitized).not.toContain('&lt;h1&gt;')
    expect(sanitized).not.toContain('&lt;p&gt;')
    expect(sanitized).not.toContain('&lt;strong&gt;')
  })

  it('sanitizer removes dangerous tags and attributes', () => {
    const maliciousHtml = `
      <p onclick="alert('xss')">Text with event handler</p>
      <script>alert('xss')</script>
      <img src="x" onerror="alert('xss')" />
      <a href="javascript:alert('xss')">Bad link</a>
    `

    const sanitized = sanitizeHtml(maliciousHtml)

    // Verify dangerous elements are removed or sanitized
    expect(sanitized).not.toContain('onclick')
    expect(sanitized).not.toContain('<script>')
    expect(sanitized).not.toContain('onerror')
    expect(sanitized).not.toContain('javascript:')
  })

  it('sanitizer preserves nested formatting', () => {
    const html = '<p>Text with <strong>bold and <em>italic</em></strong> formatting</p>'
    const sanitized = sanitizeHtml(html)

    expect(sanitized).toContain('<p>')
    expect(sanitized).toContain('<strong>')
    expect(sanitized).toContain('<em>')
    expect(sanitized).toContain('</em>')
    expect(sanitized).toContain('</strong>')
    expect(sanitized).toContain('</p>')
  })

  it('sanitizer preserves list structures', () => {
    const html = `
      <ul>
        <li>First item</li>
        <li>Second item with <strong>bold</strong></li>
        <li>Third item</li>
      </ul>
    `
    const sanitized = sanitizeHtml(html)

    expect(sanitized).toContain('<ul>')
    expect(sanitized).toContain('<li>')
    expect(sanitized).toContain('First item')
    expect(sanitized).toContain('Second item with')
    expect(sanitized).toContain('<strong>bold</strong>')
    expect(sanitized).toContain('</ul>')
  })

  it('sanitizer preserves link href attributes', () => {
    const html = '<p>Visit <a href="https://example.com">our website</a> for more info</p>'
    const sanitized = sanitizeHtml(html)

    expect(sanitized).toContain('<a href="https://example.com">')
    expect(sanitized).toContain('our website')
    expect(sanitized).toContain('</a>')
  })
})
