/**
 * Unit Tests for HtmlBlock Validation
 *
 * Tests the HtmlBlock field validation rules:
 * - Href validation: must start with / or # only
 * - Attribute restrictions: only href allowed on <a> tags
 * - Blocked URI schemes: mailto:, tel:, ftp:, javascript:, data:
 * - Blocked attributes: style=, target=, on*= handlers
 * - Allowed HTML tags
 */
import { describe, expect, it } from 'vitest'
import { HtmlBlock } from '../../../src/server/payload/blocks/HtmlBlock/config'

// Extract the validation function from the HtmlBlock config
const htmlField = HtmlBlock.fields?.find((f) => 'name' in f && f.name === 'html') as
  | { name: string; type: string; validate?: (value: string | null | undefined) => string | true }
  | undefined

const validate = htmlField?.validate

describe('HtmlBlock Validation', () => {
  describe('Basic Validation', () => {
    it('should require HTML content', () => {
      expect(validate?.(undefined)).toBe('HTML content is required')
      expect(validate?.(null)).toBe('HTML content is required')
      expect(validate?.('')).toBe('HTML content is required')
      expect(validate?.('   ')).toBe('HTML content is required')
    })

    it('should accept valid HTML', () => {
      expect(validate?.('<p>Hello</p>')).toBe(true)
      expect(validate?.('<div><p>Content</p></div>')).toBe(true)
      expect(validate?.('<h1>Title</h1><p>Paragraph</p>')).toBe(true)
    })
  })

  describe('Href Validation - ALLOWED', () => {
    it('should allow relative paths starting with /', () => {
      expect(validate?.('<a href="/about">About</a>')).toBe(true)
      expect(validate?.('<a href="/path/to/page">Link</a>')).toBe(true)
      expect(validate?.('<a href="/">Home</a>')).toBe(true)
    })

    it('should allow anchor links starting with #', () => {
      expect(validate?.('<a href="#top">Top</a>')).toBe(true)
      expect(validate?.('<a href="#section-1">Section</a>')).toBe(true)
      expect(validate?.('<a href="#anchor">Link</a>')).toBe(true)
    })

    it('should allow anchor tags with title attribute', () => {
      expect(validate?.('<a href="/about" title="About Page">About</a>')).toBe(true)
      expect(validate?.('<a href="#top" title="Back to top">Top</a>')).toBe(true)
    })

    it('should allow unquoted href values starting with /', () => {
      expect(validate?.('<a href=/about>About</a>')).toBe(true)
      expect(validate?.('<a href=/path/to/page>Link</a>')).toBe(true)
      expect(validate?.('<a href=/>Home</a>')).toBe(true)
    })

    it('should allow unquoted href values starting with #', () => {
      expect(validate?.('<a href=#top>Top</a>')).toBe(true)
      expect(validate?.('<a href=#section-1>Section</a>')).toBe(true)
    })
  })

  describe('Href Validation - DENIED', () => {
    it('should reject mailto: links', () => {
      const result = validate?.('<a href="mailto:test@example.com">Mail</a>')
      expect(result).toContain('mailto:')
      expect(result).toContain('not allowed')
    })

    it('should reject unquoted mailto: links', () => {
      const result = validate?.('<a href=mailto:test@example.com>Mail</a>')
      expect(result).toContain('mailto:')
      expect(result).toContain('not allowed')
    })

    it('should reject tel: links', () => {
      const result = validate?.('<a href="tel:+972123456789">Call</a>')
      expect(result).toContain('tel:')
      expect(result).toContain('not allowed')
    })

    it('should reject unquoted tel: links', () => {
      const result = validate?.('<a href=tel:+972123456789>Call</a>')
      expect(result).toContain('tel:')
      expect(result).toContain('not allowed')
    })

    it('should reject ftp: links', () => {
      const result = validate?.('<a href="ftp://example.com">FTP</a>')
      expect(result).toContain('ftp:')
      expect(result).toContain('not allowed')
    })

    it('should reject unquoted ftp: links', () => {
      const result = validate?.('<a href=ftp://example.com>FTP</a>')
      expect(result).toContain('ftp:')
      expect(result).toContain('not allowed')
    })

    it('should reject relative paths without leading slash (quoted)', () => {
      const result = validate?.('<a href="about">About</a>')
      expect(result).toContain('href must start with / or #')
    })

    it('should reject relative paths without leading slash (unquoted)', () => {
      const result = validate?.('<a href=about>About</a>')
      expect(result).toContain('href must start with / or #')
    })

    it('should reject protocol-relative URLs', () => {
      const result = validate?.('<a href="//evil.com">External</a>')
      expect(result).toContain('Protocol-relative')
      expect(result).toContain('not allowed')
    })

    it('should reject external http:// URLs', () => {
      const result = validate?.('<a href="http://evil.com">External</a>')
      expect(result).toContain('External URLs are not allowed')
    })

    it('should reject external https:// URLs', () => {
      const result = validate?.('<a href="https://evil.com">External</a>')
      expect(result).toContain('External URLs are not allowed')
    })

    it('should reject javascript: URLs', () => {
      const result = validate?.('<a href="javascript:alert(1)">Click</a>')
      expect(result).toContain('javascript:')
      expect(result).toContain('not allowed')
    })

    it('should reject data: URLs in href', () => {
      const result = validate?.('<a href="data:text/plain,hello">Link</a>')
      expect(result).toContain('data:')
      expect(result).toContain('not allowed')
    })
  })

  describe('Attribute Restrictions - DENIED', () => {
    it('should reject target attribute on anchor tags', () => {
      const result = validate?.('<a target="_blank" href="/x">X</a>')
      expect(result).toContain('target attribute is not allowed')
    })

    it('should reject style attribute', () => {
      const result = validate?.('<p style="color:red">x</p>')
      expect(result).toContain('Inline styles')
      expect(result).toContain('not allowed')
    })

    it('should reject onclick handlers', () => {
      const result = validate?.('<button onclick="alert(1)">Click</button>')
      expect(result).toContain('Inline event handlers')
      expect(result).toContain('not allowed')
    })

    it('should reject onload handlers', () => {
      const result = validate?.('<div onload="alert(1)">Content</div>')
      expect(result).toContain('Inline event handlers')
    })

    it('should reject any on* handlers', () => {
      const handlers = ['onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit']
      for (const handler of handlers) {
        const result = validate?.(`<div ${handler}="alert(1)">X</div>`)
        expect(result).toContain('Inline event handlers')
      }
    })

    it('should reject class attribute on <p> tags', () => {
      const result = validate?.('<p class="x">hi</p>')
      expect(result).toContain('Attributes are not allowed')
      expect(result).toContain('class=')
    })

    it('should reject id attribute on <div> tags', () => {
      const result = validate?.('<div id="x">hi</div>')
      expect(result).toContain('Attributes are not allowed')
      expect(result).toContain('id=')
    })

    it('should reject data-* attributes on <span> tags', () => {
      const result = validate?.('<span data-x="1">hi</span>')
      expect(result).toContain('Attributes are not allowed')
      expect(result).toContain('data-x=')
    })

    it('should reject class attribute on <span> tags', () => {
      const result = validate?.('<span class="highlight">hi</span>')
      expect(result).toContain('Attributes are not allowed')
      expect(result).toContain('class=')
    })
  })

  describe('Attribute Restrictions - ALLOWED', () => {
    it('should allow simple anchor with href only', () => {
      expect(validate?.('<a href="/page">Link</a>')).toBe(true)
    })

    it('should allow anchor with href and title', () => {
      expect(validate?.('<a href="/page" title="Page Title">Link</a>')).toBe(true)
    })

    it('should allow HTML without attributes on other tags', () => {
      expect(validate?.('<p>Simple paragraph</p>')).toBe(true)
      expect(validate?.('<div><h1>Title</h1><p>Content</p></div>')).toBe(true)
      expect(validate?.('<ul><li>Item 1</li><li>Item 2</li></ul>')).toBe(true)
    })
  })

  describe('Blocked Tags', () => {
    it('should reject <script> tags', () => {
      const result = validate?.('<script>alert(1)</script>')
      expect(result).toContain('<script')
    })

    it('should reject <iframe> tags', () => {
      const result = validate?.('<iframe src="evil.com"></iframe>')
      expect(result).toContain('<iframe')
    })

    it('should reject <object> tags', () => {
      const result = validate?.('<object data="evil.swf"></object>')
      expect(result).toContain('<object')
    })

    it('should reject <style> tags', () => {
      const result = validate?.('<style>p { color: red; }</style>')
      expect(result).toContain('<style')
    })

    it('should reject <meta> tags', () => {
      const result = validate?.('<meta http-equiv="refresh" content="0">')
      expect(result).toContain('<meta')
    })

    it('should reject <base> tags', () => {
      const result = validate?.('<base href="evil.com">')
      expect(result).toContain('<base')
    })
  })

  describe('Allowed Tags', () => {
    it('should allow basic formatting tags', () => {
      expect(validate?.('<p><strong>Bold</strong> and <em>italic</em></p>')).toBe(true)
      expect(validate?.('<p><b>Bold</b> <i>italic</i> <u>underline</u></p>')).toBe(true)
      expect(validate?.('<p><s>Strikethrough</s></p>')).toBe(true)
    })

    it('should allow heading tags', () => {
      expect(validate?.('<h1>Title 1</h1>')).toBe(true)
      expect(validate?.('<h2>Title 2</h2>')).toBe(true)
      expect(validate?.('<h3>Title 3</h3>')).toBe(true)
    })

    it('should allow list tags', () => {
      expect(validate?.('<ul><li>Item</li></ul>')).toBe(true)
      expect(validate?.('<ol><li>Item</li></ol>')).toBe(true)
    })

    it('should allow block-level tags', () => {
      expect(validate?.('<blockquote>Quote</blockquote>')).toBe(true)
      expect(validate?.('<pre>Code block</pre>')).toBe(true)
      expect(validate?.('<code>Inline code</code>')).toBe(true)
      expect(validate?.('<hr/>')).toBe(true)
      expect(validate?.('<br/>')).toBe(true)
    })

    it('should allow span and div tags', () => {
      expect(validate?.('<span>Text</span>')).toBe(true)
      expect(validate?.('<div>Container</div>')).toBe(true)
    })
  })

  describe('Disallowed Tags', () => {
    it('should reject <form> tags', () => {
      const result = validate?.('<form><input/></form>')
      expect(result).toMatch(/disallowed tag|Attributes are not allowed/)
    })

    it('should reject <input> tags', () => {
      const result = validate?.('<input type="text"/>')
      expect(result).toMatch(/disallowed tag|Attributes are not allowed/)
    })

    it('should reject <img> tags', () => {
      const result = validate?.('<img src="picture.jpg"/>')
      expect(result).toMatch(/disallowed tag|Attributes are not allowed/)
    })

    it('should reject <video> tags', () => {
      const result = validate?.('<video src="video.mp4"></video>')
      expect(result).toMatch(/disallowed tag|Attributes are not allowed/)
    })

    it('should reject <audio> tags', () => {
      const result = validate?.('<audio src="audio.mp3"></audio>')
      expect(result).toMatch(/disallowed tag|Attributes are not allowed/)
    })
  })
})
