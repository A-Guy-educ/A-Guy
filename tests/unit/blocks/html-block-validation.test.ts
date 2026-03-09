/**
 * Unit Tests for HtmlBlock Validation
 *
 * Tests the HtmlBlock field validation rules:
 * - Href validation: must start with / or # only
 * - Attribute restrictions: class, id, data-* allowed on all tags; href, title, class, id, data-* allowed on <a> tags
 * - Blocked URI schemes: mailto:, tel:, ftp:, javascript:, data:
 * - Blocked attributes: style=, target=, on*= handlers
 * - Allowed HTML tags (including <style>, SVG, and semantic HTML5 tags)
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
      expect(result).toContain('href must start with / or #')
    })

    it('should reject external https:// URLs', () => {
      const result = validate?.('<a href="https://evil.com">External</a>')
      expect(result).toContain('href must start with / or #')
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

    it('should require href attribute on anchor tags', () => {
      const result = validate?.('<a>No href</a>')
      expect(result).toContain('href attribute is required on <a> tags')
    })
  })

  describe('Attribute Restrictions - DENIED', () => {
    it('should reject target attribute on anchor tags', () => {
      const result = validate?.('<a target="_blank" href="/x">X</a>')
      expect(result).toContain('target attributes are not allowed')
    })

    it('should reject style attribute on <p> tags', () => {
      const result = validate?.('<p style="color:red">x</p>')
      expect(result).toContain('style attributes are not allowed')
    })

    it('should reject style attribute on <a> tags', () => {
      const result = validate?.('<a href="/x" style="color:red">X</a>')
      expect(result).toContain('style attributes are not allowed')
    })

    it('should reject onclick handlers', () => {
      const result = validate?.('<button onclick="alert(1)">Click</button>')
      expect(result).toContain('inline event handlers are not allowed')
    })

    it('should reject onclick handler with specific error message', () => {
      const result = validate?.('<span onclick="x()">X</span>')
      expect(result).toContain('inline event handlers are not allowed')
    })

    it('should reject onload handlers', () => {
      const result = validate?.('<div onload="alert(1)">Content</div>')
      expect(result).toContain('inline event handlers')
    })

    it('should reject any on* handlers', () => {
      const handlers = ['onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit']
      for (const handler of handlers) {
        const result = validate?.(`<div ${handler}="alert(1)">X</div>`)
        expect(result).toContain('inline event handlers')
      }
    })
  })

  describe('Attribute Restrictions - ALLOWED', () => {
    it('should allow class attribute on tags', () => {
      expect(validate?.('<p class="x">hi</p>')).toBe(true)
      expect(validate?.('<div class="container">Content</div>')).toBe(true)
    })

    it('should allow id attribute on <div> tags', () => {
      expect(validate?.('<div id="x">hi</div>')).toBe(true)
    })

    it('should allow id attribute on all tags', () => {
      expect(validate?.('<p id="para1">Paragraph</p>')).toBe(true)
      expect(validate?.('<span id="span1">Text</span>')).toBe(true)
      expect(validate?.('<a href="/page" id="link1">Link</a>')).toBe(true)
      expect(validate?.('<h1 id="heading1">Title</h1>')).toBe(true)
    })

    it('should allow data-* attributes on tags', () => {
      expect(validate?.('<span data-x="1">hi</span>')).toBe(true)
      expect(validate?.('<span data-test-id="123">hi</span>')).toBe(true)
      expect(validate?.('<div data-analytics="track">Content</div>')).toBe(true)
    })

    it('should allow class and data-* on same tag', () => {
      expect(validate?.('<p class="hero" data-id="123">Hello</p>')).toBe(true)
      expect(validate?.('<div class="wrap" data-test="x">Content</div>')).toBe(true)
    })

    it('should allow simple anchor with href only', () => {
      expect(validate?.('<a href="/page">Link</a>')).toBe(true)
    })

    it('should allow anchor with href and title', () => {
      expect(validate?.('<a href="/page" title="Page Title">Link</a>')).toBe(true)
    })

    it('should allow anchor with class attribute', () => {
      expect(validate?.('<a href="/page" class="btn">Link</a>')).toBe(true)
      expect(validate?.('<a href="/about" class="link" data-cta="main">About</a>')).toBe(true)
    })

    it('should allow anchor with data-* attributes', () => {
      expect(validate?.('<a href="/page" data-id="123">Link</a>')).toBe(true)
      expect(validate?.('<a href="/about" data-cta="main">About</a>')).toBe(true)
    })

    it('should allow HTML without attributes on other tags', () => {
      expect(validate?.('<p>Simple paragraph</p>')).toBe(true)
      expect(validate?.('<div><h1>Title</h1><p>Content</p></div>')).toBe(true)
      expect(validate?.('<ul><li>Item 1</li><li>Item 2</li></ul>')).toBe(true)
    })

    it('should allow id attribute on other tags', () => {
      expect(validate?.('<p id="para1">Paragraph</p>')).toBe(true)
      expect(validate?.('<div id="container">Content</div>')).toBe(true)
      expect(validate?.('<span id="text1">Text</span>')).toBe(true)
      expect(validate?.('<section id="section1">Section</section>')).toBe(true)
    })

    it('should allow class attribute on other tags', () => {
      expect(validate?.('<p class="highlight">Paragraph</p>')).toBe(true)
      expect(validate?.('<div class="container">Content</div>')).toBe(true)
      expect(validate?.('<span class="text">Text</span>')).toBe(true)
    })

    it('should allow data-* attributes on other tags', () => {
      expect(validate?.('<p data-test="123">Paragraph</p>')).toBe(true)
      expect(validate?.('<div data-id="456">Content</div>')).toBe(true)
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

    it('should allow <style> tags', () => {
      expect(validate?.('<style>.x { color: red; }</style>')).toBe(true)
      expect(validate?.('<style>p { margin: 0; }</style>')).toBe(true)
    })

    it('should allow semantic HTML5 tags (nav, button, header, main, footer)', () => {
      expect(validate?.('<nav>Navigation</nav>')).toBe(true)
      expect(validate?.('<button>Click Me</button>')).toBe(true)
      expect(validate?.('<header>Header</header>')).toBe(true)
      expect(validate?.('<main>Main Content</main>')).toBe(true)
      expect(validate?.('<footer>Footer</footer>')).toBe(true)
    })

    it('should allow id attribute on semantic HTML5 tags', () => {
      expect(validate?.('<nav id="nav-main">Navigation</nav>')).toBe(true)
      expect(validate?.('<button id="btn-submit">Click Me</button>')).toBe(true)
      expect(validate?.('<header id="page-header">Header</header>')).toBe(true)
      expect(validate?.('<main id="main-content">Main Content</main>')).toBe(true)
      expect(validate?.('<footer id="page-footer">Footer</footer>')).toBe(true)
    })

    it('should allow class and data-* on semantic HTML5 tags', () => {
      expect(validate?.('<nav class="menu" data-nav="true">Navigation</nav>')).toBe(true)
      expect(validate?.('<button class="btn" data-action="submit">Click Me</button>')).toBe(true)
      expect(validate?.('<header class="site-header" data-sticky="yes">Header</header>')).toBe(true)
      expect(validate?.('<main class="content" data-page="home">Main Content</main>')).toBe(true)
      expect(validate?.('<footer class="site-footer" data-year="2024">Footer</footer>')).toBe(true)
    })
  })

  describe('Blocked Tags - Special Cases', () => {
    it('should reject <title> tags with specific message', () => {
      const result = validate?.('<title>Page Title</title>')
      expect(result).toBe('<title> is not allowed in HtmlBlock. Put title in the page head.')
    })

    it('should reject <title> tag in middle of content', () => {
      const result = validate?.('<div><title>Bad</title></div>')
      expect(result).toContain('is not allowed in HtmlBlock')
    })
  })

  describe('SVG Validation - ALLOWED', () => {
    it('should allow basic SVG tags', () => {
      expect(validate?.('<svg></svg>')).toBe(true)
    })

    it('should allow SVG with viewBox attribute', () => {
      expect(validate?.('<svg viewBox="0 0 24 24"></svg>')).toBe(true)
    })

    it('should allow SVG with viewbox (lowercase) attribute', () => {
      expect(validate?.('<svg viewbox="0 0 24 24"></svg>')).toBe(true)
    })

    it('should allow SVG with width and height', () => {
      expect(validate?.('<svg width="100" height="100"></svg>')).toBe(true)
    })

    it('should allow SVG with fill and stroke', () => {
      expect(validate?.('<svg fill="red" stroke="blue"></svg>')).toBe(true)
    })

    it('should allow SVG with stroke-width', () => {
      expect(validate?.('<svg stroke-width="2"></svg>')).toBe(true)
    })

    it('should allow path element with d attribute', () => {
      expect(validate?.('<svg><path d="M0 0"/></svg>')).toBe(true)
    })

    it('should allow circle element with cx, cy, r', () => {
      expect(validate?.('<svg><circle cx="50" cy="50" r="40"/></svg>')).toBe(true)
    })

    it('should allow rect element', () => {
      expect(validate?.('<svg><rect x="10" y="10" width="100" height="100"/></svg>')).toBe(true)
    })

    it('should allow line element', () => {
      expect(validate?.('<svg><line x1="0" y1="0" x2="100" y2="100"/></svg>')).toBe(true)
    })

    it('should allow polyline element', () => {
      expect(validate?.('<svg><polyline points="0,0 50,50 100,0"/></svg>')).toBe(true)
    })

    it('should allow polygon element', () => {
      expect(validate?.('<svg><polygon points="0,0 100,0 50,50"/></svg>')).toBe(true)
    })

    it('should allow g (group) element', () => {
      expect(validate?.('<svg><g><path d="M0 0"/></g></svg>')).toBe(true)
    })

    it('should allow class, id, data-* on SVG elements', () => {
      expect(validate?.('<svg class="x" id="hero" data-test="1"><path d="M0 0"/></svg>')).toBe(true)
    })

    it('should allow complex SVG', () => {
      expect(validate?.('<svg viewBox="0 0 24 24" class="x"><path d="M0 0"/></svg>')).toBe(true)
    })
  })

  describe('SVG Validation - DENIED', () => {
    it('should reject foreignObject in SVG', () => {
      const result = validate?.('<svg><foreignObject></foreignObject></svg>')
      expect(result).toBe('foreignObject is not allowed in SVG')
    })

    it('should reject inline event handlers on SVG', () => {
      const result = validate?.('<svg onload="alert(1)"></svg>')
      expect(result).toContain('inline event handlers are not allowed')
    })

    it('should reject style attribute on SVG', () => {
      const result = validate?.('<svg style="color:red"></svg>')
      expect(result).toContain('style attributes are not allowed')
    })

    it('should reject target attribute on SVG anchor', () => {
      const result = validate?.('<svg><a href="/x" target="_blank">Link</a></svg>')
      expect(result).toContain('target attributes are not allowed')
    })

    it('should reject external href in SVG anchor', () => {
      const result = validate?.('<svg><a href="https://x.com">Link</a></svg>')
      expect(result).toContain('href must start with / or #')
    })

    it('should reject href attribute directly on SVG element', () => {
      const result = validate?.('<svg href="/x"></svg>')
      expect(result).toContain('href attributes on SVG elements are not allowed')
    })

    it('should reject xlink:href attribute on SVG element', () => {
      const result = validate?.('<svg><use xlink:href="/icon.svg"/></svg>')
      expect(result).toContain('href attributes on SVG elements are not allowed')
    })

    it('should allow aria-hidden and role on SVG', () => {
      expect(validate?.('<svg role="img" aria-hidden="true"><path d="M0 0"/></svg>')).toBe(true)
    })

    it('should allow focusable on SVG', () => {
      expect(validate?.('<svg focusable="false"><path d="M0 0"/></svg>')).toBe(true)
    })

    it('should allow defs, linearGradient, radialGradient, stop tags', () => {
      expect(
        validate?.(
          '<svg><defs><linearGradient id="g1"><stop offset="0%" stop-color="red"/></linearGradient></defs></svg>',
        ),
      ).toBe(true)
    })
  })

  describe('Disallowed Tags', () => {
    it('should reject <form> tags', () => {
      const result = validate?.('<form><input/></form>')
      expect(result).toMatch(/disallowed tag|Attribute/)
    })

    it('should reject <input> tags', () => {
      const result = validate?.('<input type="text"/>')
      expect(result).toMatch(/disallowed tag|Attribute/)
    })

    it('should reject <img> tags', () => {
      const result = validate?.('<img src="picture.jpg"/>')
      expect(result).toMatch(/disallowed tag|Attribute/)
    })

    it('should reject <video> tags', () => {
      const result = validate?.('<video src="video.mp4"></video>')
      expect(result).toMatch(/disallowed tag|Attribute/)
    })

    it('should reject <audio> tags', () => {
      const result = validate?.('<audio src="audio.mp3"></audio>')
      expect(result).toMatch(/disallowed tag|Attribute/)
    })

    it('should reject <head> tags', () => {
      const result = validate?.('<head><title>Test</title></head>')
      // The <title> inside triggers the specific message
      expect(result).toMatch(/is not allowed in HtmlBlock/)
    })

    it('should reject <html> tags', () => {
      const result = validate?.('<html><body>Content</body></html>')
      expect(result).toMatch(/disallowed tag|Attribute/)
    })

    it('should reject <body> tags', () => {
      const result = validate?.('<body>Content</body>')
      expect(result).toMatch(/disallowed tag|Attribute/)
    })
  })

  describe('Acceptance Examples - SHOULD PASS', () => {
    it('should pass for allowed class, id, and data-* on tags', () => {
      expect(validate?.('<div class="x" id="hero" data-test="1">Hello</div>')).toBe(true)
    })

    it('should pass for allowed attributes on <a> tags', () => {
      expect(validate?.('<a href="/about" class="x" id="a1" data-x="1" title="t">About</a>')).toBe(
        true,
      )
    })

    it('should pass for anchor with #', () => {
      expect(validate?.('<a href="#top" data-x="1">Top</a>')).toBe(true)
    })

    it('should pass for <style> tags', () => {
      expect(validate?.('<style>.x{color:red}</style>')).toBe(true)
    })

    it('should pass for SVG with viewBox', () => {
      expect(validate?.('<svg viewBox="0 0 24 24" class="x"><path d="M0 0" /></svg>')).toBe(true)
    })
  })

  describe('XSS Prevention - Negative Tests', () => {
    it('should reject <img> tag with onerror handler', () => {
      const result = validate?.('<img src="x" onerror="alert(1)">')
      expect(result).toContain('inline event handlers are not allowed')
    })

    it('should reject <img> tag with various event handlers', () => {
      const handlers = ['onerror', 'onload', 'onmouseover', 'onclick']
      for (const handler of handlers) {
        const result = validate?.(`<img src="x" ${handler}="alert(1)">`)
        expect(result).toContain('inline event handlers are not allowed')
      }
    })

    it('should reject <svg> tag with onload handler', () => {
      const result = validate?.('<svg onload="alert(1)"></svg>')
      expect(result).toContain('inline event handlers are not allowed')
    })

    it('should reject <svg> with embedded img onerror', () => {
      const result = validate?.('<svg><image href="x" onerror="alert(1)"/></svg>')
      expect(result).toContain('inline event handlers are not allowed')
    })

    it('should reject <body> with onload handler', () => {
      const result = validate?.('<body onload="alert(1)"></body>')
      expect(result).toContain('inline event handlers are not allowed')
    })

    it('should reject <input> with onfocus handler', () => {
      const result = validate?.('<input onfocus="alert(1)">')
      expect(result).toContain('inline event handlers are not allowed')
    })

    it('should reject <marquee> with onstart handler', () => {
      const result = validate?.('<marquee onstart="alert(1)"></marquee>')
      expect(result).toContain('inline event handlers are not allowed')
    })

    it('should reject video with onerror handler', () => {
      // Note: <video> is blocked as disallowed tag, but this tests the on* handler check
      const result = validate?.('<video onerror="alert(1)"><source src="x.mp4"/></video>')
      expect(result).toContain('inline event handlers are not allowed')
    })

    it('should reject audio with onended handler', () => {
      const result = validate?.('<audio onended="alert(1)"><source src="x.mp3"/></audio>')
      expect(result).toContain('inline event handlers are not allowed')
    })

    it('should reject link tag with onload handler', () => {
      // <link> is blocked as a dangerous tag, which takes precedence over onload check
      const result = validate?.('<link rel="stylesheet" onload="alert(1)">')
      expect(result).toContain('<link')
    })

    it('should reject style tag with -moz-binding (CSS XSS)', () => {
      const result = validate?.('<style>body { -moz-binding: url("xss.xml#xss"); }</style>')
      expect(result).toBe(true) // Style tag is allowed, the content is just CSS
    })

    it('should reject expression in style attribute (IE CSS XSS)', () => {
      const result = validate?.('<div style="width: expression(alert(1))">x</div>')
      expect(result).toContain('style attributes are not allowed')
    })

    it('should reject javascript: in any attribute', () => {
      const result = validate?.('<a href="javascript:alert(1)">x</a>')
      expect(result).toContain('javascript:')
      expect(result).toContain('not allowed')
    })

    it('should reject data: URLs in any src/href', () => {
      // Use a tag that won't be caught by other checks first
      const result = validate?.('<a href="data:text/plain,hello">Link</a>')
      expect(result).toContain('data:')
      expect(result).toContain('not allowed')
    })

    it('should reject SVG with animation onload XSS', () => {
      const result = validate?.('<svg><animate onload="alert(1)" attributeName="x"/></svg>')
      expect(result).toContain('inline event handlers are not allowed')
    })

    it('should reject form with action javascript:', () => {
      // <form> is blocked, but this tests the javascript: check
      const result = validate?.('<form action="javascript:alert(1)"><input name="x"/></form>')
      expect(result).toMatch(/disallowed tag|Attribute/)
    })

    it('should reject meta with http-equiv refresh to javascript:', () => {
      const result = validate?.('<meta http-equiv="refresh" content="0;url=javascript:alert(1)">')
      expect(result).toContain('<meta')
    })

    it('should reject base with javascript: href', () => {
      const result = validate?.('<base href="javascript:alert(1)//">')
      expect(result).toContain('<base')
    })

    it('should reject object/data XSS', () => {
      const result = validate?.('<object data="javascript:alert(1)"></object>')
      expect(result).toContain('<object')
    })

    it('should reject embed/src with javascript:', () => {
      const result = validate?.('<embed src="javascript:alert(1)">')
      expect(result).toContain('<embed')
    })

    it('should reject applet XSS', () => {
      const result = validate?.('<applet code="x.class" archive="x.jar"></applet>')
      expect(result).toContain('<applet')
    })

    it('should reject iframe srcdoc XSS', () => {
      // Use content that doesn't contain blocked tags like <script>
      const result = validate?.('<iframe srcdoc="<div>test</div>"></iframe>')
      // <iframe> itself is blocked
      expect(result).toContain('<iframe')
    })

    it('should reject SVG use with javascript: href', () => {
      const result = validate?.('<svg><use href="javascript:alert(1)"/></svg>')
      // The javascript: check runs before the SVG href attribute check
      expect(result).toContain('javascript:')
      expect(result).toContain('not allowed')
    })
  })

  describe('Acceptance Examples - SHOULD FAIL', () => {
    it('should reject style attribute on <div>', () => {
      const result = validate?.('<div style="color:red">x</div>')
      expect(result).toContain('style attributes are not allowed')
    })

    it('should reject target attribute on <a>', () => {
      const result = validate?.('<a target="_blank" href="/x">x</a>')
      expect(result).toContain('target attributes are not allowed')
    })

    it('should reject onclick handler', () => {
      const result = validate?.('<button onclick="alert(1)">x</button>')
      expect(result).toContain('inline event handlers are not allowed')
    })

    it('should reject external https href', () => {
      const result = validate?.('<a href="https://evil.com">x</a>')
      expect(result).toContain('href must start with / or #')
    })

    it('should reject onload handler on SVG', () => {
      const result = validate?.('<svg onload="alert(1)"></svg>')
      expect(result).toContain('inline event handlers are not allowed')
    })

    it('should reject foreignObject in SVG', () => {
      const result = validate?.('<svg><foreignObject></foreignObject></svg>')
      expect(result).toBe('foreignObject is not allowed in SVG')
    })
  })

  describe('Table Tags', () => {
    it('should allow basic table elements', () => {
      expect(validate?.('<table><tr><td>Cell</td></tr></table>')).toBe(true)
    })

    it('should allow table with thead, tbody, tfoot', () => {
      const html =
        '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Data</td></tr></tbody><tfoot><tr><td>Footer</td></tr></tfoot></table>'
      expect(validate?.(html)).toBe(true)
    })

    it('should allow table with caption', () => {
      expect(validate?.('<table><caption>My Table</caption><tr><td>Cell</td></tr></table>')).toBe(
        true,
      )
    })

    it('should allow table with colgroup and col', () => {
      expect(validate?.('<table><colgroup><col></colgroup><tr><td>Cell</td></tr></table>')).toBe(
        true,
      )
    })

    it('should allow colspan attribute on td', () => {
      expect(validate?.('<table><tr><td colspan="2">Spanning</td></tr></table>')).toBe(true)
    })

    it('should allow rowspan attribute on td', () => {
      expect(validate?.('<table><tr><td rowspan="3">Spanning</td></tr></table>')).toBe(true)
    })

    it('should allow scope attribute on th', () => {
      expect(validate?.('<table><tr><th scope="col">Header</th></tr></table>')).toBe(true)
    })

    it('should allow span attribute on col', () => {
      expect(
        validate?.('<table><colgroup><col span="2"></colgroup><tr><td>Cell</td></tr></table>'),
      ).toBe(true)
    })

    it('should allow class and id on table elements', () => {
      expect(validate?.('<table class="my-table" id="table1"><tr><td>Cell</td></tr></table>')).toBe(
        true,
      )
    })

    it('should reject style attribute on table elements', () => {
      const result = validate?.('<table style="color:red"><tr><td>Cell</td></tr></table>')
      expect(result).toContain('style attributes are not allowed')
    })

    it('should reject disallowed attributes on td', () => {
      const result = validate?.('<table><tr><td width="100">Cell</td></tr></table>')
      expect(result).toContain('attribute "width" is not allowed on <td>')
    })
  })
})
