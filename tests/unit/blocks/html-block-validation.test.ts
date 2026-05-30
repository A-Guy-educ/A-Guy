/**
 * Unit Tests for HtmlBlock Validation (Issue #2101)
 *
 * Tests the HtmlBlock field validation rules after removing HTML sanitization restrictions.
 * Since this is admin-only content (only authorized content creators have access),
 * most HTML sanitization has been removed to allow rich content including
 * style attributes, details/summary tags, data-* attributes, etc.
 *
 * Remaining restrictions are only for critical security:
 * - Dangerous tags: <script>, <iframe>, <object>, <embed>, <applet>, <meta>, <base>, <link>, <title>
 * - Inline event handlers (on*): XSS prevention
 * - javascript: URLs: XSS prevention
 */
import { describe, expect, it } from 'vitest'
import { HtmlBlock } from '../../../src/server/payload/blocks/HtmlBlock/config'

// Extract the validation function from the HtmlBlock config
const htmlField = HtmlBlock.fields?.find((f) => 'name' in f && f.name === 'html') as
  | { name: string; type: string; validate?: (value: string | null | undefined) => string | true }
  | undefined

const validate = htmlField?.validate

describe('HtmlBlock Validation (Issue #2101)', () => {
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

  describe('Still Blocked - Dangerous Tags', () => {
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

    it('should reject <embed> tags', () => {
      const result = validate?.('<embed src="evil.swf"></embed>')
      expect(result).toContain('<embed')
    })

    it('should reject <applet> tags', () => {
      const result = validate?.('<applet code="x.class" archive="x.jar"></applet>')
      expect(result).toContain('<applet')
    })

    it('should reject <meta> tags', () => {
      const result = validate?.('<meta http-equiv="refresh" content="0">')
      expect(result).toContain('<meta')
    })

    it('should reject <base> tags', () => {
      const result = validate?.('<base href="evil.com">')
      expect(result).toContain('<base')
    })

    it('should reject <link> tags', () => {
      const result = validate?.('<link rel="stylesheet" href="evil.css">')
      expect(result).toContain('<link')
    })

    it('should reject <title> tags with specific message', () => {
      const result = validate?.('<title>Page Title</title>')
      expect(result).toBe('<title> is not allowed in HtmlBlock. Put title in the page head.')
    })

    it('should reject <title> tag in middle of content', () => {
      const result = validate?.('<div><title>Bad</title></div>')
      expect(result).toContain('is not allowed in HtmlBlock')
    })
  })

  describe('Still Blocked - Inline Event Handlers (XSS Prevention)', () => {
    it('should reject onclick handlers', () => {
      const result = validate?.('<button onclick="alert(1)">Click</button>')
      expect(result).toContain('inline event handlers are not allowed')
    })

    it('should reject onload handlers', () => {
      const result = validate?.('<div onload="alert(1)">Content</div>')
      expect(result).toContain('inline event handlers are not allowed')
    })

    it('should reject any on* handlers', () => {
      const handlers = ['onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit', 'onerror']
      for (const handler of handlers) {
        const result = validate?.(`<div ${handler}="alert(1)">X</div>`)
        expect(result).toContain('inline event handlers are not allowed')
      }
    })

    it('should reject onerror on img', () => {
      const result = validate?.('<img src="x" onerror="alert(1)">')
      expect(result).toContain('inline event handlers are not allowed')
    })

    it('should reject SVG with onload handler', () => {
      const result = validate?.('<svg onload="alert(1)"></svg>')
      expect(result).toContain('inline event handlers are not allowed')
    })
  })

  describe('Still Blocked - javascript: URLs (XSS Prevention)', () => {
    it('should reject javascript: URLs in href', () => {
      const result = validate?.('<a href="javascript:alert(1)">Click</a>')
      expect(result).toContain('javascript:')
      expect(result).toContain('not allowed')
    })

    it('should reject javascript: URLs in src', () => {
      const result = validate?.('<svg><use href="javascript:alert(1)"/></svg>')
      expect(result).toContain('javascript:')
      expect(result).toContain('not allowed')
    })
  })

  // ===== Issue #2101: Now ALLOWED =====

  describe('Style Attribute - NOW ALLOWED (Issue #2101)', () => {
    it('should allow style attribute on div', () => {
      expect(validate?.('<div style="color:red">x</div>')).toBe(true)
    })

    it('should allow style attribute on p', () => {
      expect(validate?.('<p style="color:red">x</p>')).toBe(true)
    })

    it('should allow style attribute on span', () => {
      expect(validate?.('<span style="font-weight:bold">x</span>')).toBe(true)
    })

    it('should allow style attribute on a', () => {
      expect(validate?.('<a href="/x" style="color:blue">x</a>')).toBe(true)
    })

    it('should allow inline style with direction and border', () => {
      expect(
        validate?.('<div style="direction: rtl; border: 2px solid #e1e4e8;">Content</div>'),
      ).toBe(true)
    })

    it('should allow style with expression (IE CSS XSS - but admin only)', () => {
      // This is allowed since it's admin content
      expect(validate?.('<div style="width: expression(alert(1))">x</div>')).toBe(true)
    })
  })

  describe('Details/Summary Tags - NOW ALLOWED (Issue #2101)', () => {
    it('should allow details tag', () => {
      expect(validate?.('<details><summary>Title</summary><p>Content</p></details>')).toBe(true)
    })

    it('should allow details tag with emoji in summary', () => {
      expect(
        validate?.('<details><summary>💡 Click for solution</summary><p>Answer</p></details>'),
      ).toBe(true)
    })

    it('should allow nested details', () => {
      expect(
        validate?.(
          '<details><summary>Outer</summary><details><summary>Inner</summary></details></details>',
        ),
      ).toBe(true)
    })

    it('should allow details with inline styles', () => {
      expect(
        validate?.(
          '<details style="margin: 10px;"><summary style="font-weight: bold;">Title</summary></details>',
        ),
      ).toBe(true)
    })
  })

  describe('Dir Attribute - NOW ALLOWED (Issue #2101)', () => {
    it('should allow dir attribute on div', () => {
      expect(validate?.('<div dir="rtl">שלום</div>')).toBe(true)
    })

    it('should allow dir attribute on p', () => {
      expect(validate?.('<p dir="ltr">Hello</p>')).toBe(true)
    })

    it('should allow dir attribute combined with style', () => {
      expect(validate?.('<div dir="rtl" style="text-align: right;">טקסט בעברית</div>')).toBe(true)
    })
  })

  describe('External URLs - NOW ALLOWED (Issue #2101)', () => {
    it('should allow external https URLs', () => {
      expect(validate?.('<a href="https://example.com">External</a>')).toBe(true)
    })

    it('should allow external http URLs', () => {
      expect(validate?.('<a href="http://example.com">External</a>')).toBe(true)
    })

    it('should allow protocol-relative URLs', () => {
      expect(validate?.('<a href="//evil.com">External</a>')).toBe(true)
    })

    it('should allow mailto: links', () => {
      expect(validate?.('<a href="mailto:test@example.com">Mail</a>')).toBe(true)
    })

    it('should allow tel: links', () => {
      expect(validate?.('<a href="tel:+972123456789">Call</a>')).toBe(true)
    })

    it('should allow ftp: links', () => {
      expect(validate?.('<a href="ftp://example.com">FTP</a>')).toBe(true)
    })

    it('should allow data: URLs', () => {
      expect(validate?.('<a href="data:text/plain,hello">Link</a>')).toBe(true)
    })

    it('should allow relative paths without leading slash', () => {
      expect(validate?.('<a href="about">About</a>')).toBe(true)
    })
  })

  describe('Target Attribute - NOW ALLOWED (Issue #2101)', () => {
    it('should allow target attribute on anchor tags', () => {
      expect(validate?.('<a target="_blank" href="/x">X</a>')).toBe(true)
    })

    it('should allow target on anchor with external URL', () => {
      expect(validate?.('<a target="_blank" href="https://example.com">Open</a>')).toBe(true)
    })
  })

  describe('Form Elements - NOW ALLOWED (Issue #2101)', () => {
    it('should allow form tags', () => {
      expect(validate?.('<form><input/></form>')).toBe(true)
    })

    it('should allow input tags', () => {
      expect(validate?.('<input type="text"/>')).toBe(true)
    })

    it('should allow img tags', () => {
      expect(validate?.('<img src="picture.jpg"/>')).toBe(true)
    })

    it('should allow video tags', () => {
      expect(validate?.('<video src="video.mp4"></video>')).toBe(true)
    })

    it('should allow audio tags', () => {
      expect(validate?.('<audio src="audio.mp3"></audio>')).toBe(true)
    })

    it('should allow html and body tags', () => {
      expect(validate?.('<html><body>Content</body></html>')).toBe(true)
    })

    it('should allow marquee tags', () => {
      expect(validate?.('<marquee>Scrolling text</marquee>')).toBe(true)
    })
  })

  describe('SVG Improvements - NOW ALLOWED (Issue #2101)', () => {
    it('should allow foreignObject in SVG', () => {
      expect(validate?.('<svg><foreignObject><div>Content</div></foreignObject></svg>')).toBe(true)
    })

    it('should allow style attribute on SVG', () => {
      expect(validate?.('<svg style="color:red"></svg>')).toBe(true)
    })

    it('should allow href attribute on SVG elements', () => {
      expect(validate?.('<svg href="/x"></svg>')).toBe(true)
    })

    it('should allow external href in SVG anchor', () => {
      expect(validate?.('<svg><a href="https://x.com">Link</a></svg>')).toBe(true)
    })

    it('should allow xlink:href on SVG elements', () => {
      expect(validate?.('<svg><use xlink:href="/icon.svg"/></svg>')).toBe(true)
    })

    it('should allow target on SVG anchor', () => {
      expect(validate?.('<svg><a href="/x" target="_blank">Link</a></svg>')).toBe(true)
    })
  })

  describe('Other Attributes - NOW ALLOWED (Issue #2101)', () => {
    it('should allow width attribute on td', () => {
      expect(validate?.('<table><tr><td width="100">Cell</td></tr></table>')).toBe(true)
    })

    it('should allow any attribute on any tag', () => {
      expect(validate?.('<div some-random-attr="value">Content</div>')).toBe(true)
    })
  })

  describe('Combined Example from Issue #2101', () => {
    it('should allow the exact HTML example from issue', () => {
      const html = `<div style="direction: rtl; border: 2px solid #e1e4e8;">
  <details>
    <summary>💡 לחץ כאן לפתרון</summary>
    <p>תוכן הפתרון</p>
  </details>
</div>`
      expect(validate?.(html)).toBe(true)
    })
  })

  describe('Allowed Tags (Existing behavior retained)', () => {
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

    it('should allow <style> tags', () => {
      expect(validate?.('<style>.x { color: red; }</style>')).toBe(true)
    })

    it('should allow semantic HTML5 tags', () => {
      expect(validate?.('<nav>Navigation</nav>')).toBe(true)
      expect(validate?.('<button>Click Me</button>')).toBe(true)
      expect(validate?.('<header>Header</header>')).toBe(true)
      expect(validate?.('<main>Main Content</main>')).toBe(true)
      expect(validate?.('<footer>Footer</footer>')).toBe(true)
    })

    it('should allow SVG tags', () => {
      expect(validate?.('<svg></svg>')).toBe(true)
      expect(validate?.('<svg viewBox="0 0 24 24"></svg>')).toBe(true)
      expect(validate?.('<svg><path d="M0 0"/></svg>')).toBe(true)
    })

    it('should allow table tags', () => {
      expect(validate?.('<table><tr><td>Cell</td></tr></table>')).toBe(true)
    })
  })
})
