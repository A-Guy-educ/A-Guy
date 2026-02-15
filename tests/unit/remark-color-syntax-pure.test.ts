/**
 * Pure unit tests for remark-color-syntax plugin (no React/jsdom)
 * Tests mdast transformation directly
 */

import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { remarkColorSyntax } from '@/lib/remark-plugins/remark-color-syntax'

/**
 * Helper to parse markdown → mdast → apply plugin → hast → HTML
 */
async function processMarkdown(markdown: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkColorSyntax)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(markdown)

  return String(result)
}

describe('remarkColorSyntax - Pure Unit Tests', () => {
  describe('Basic Color Parsing', () => {
    it('should transform ::red{text} to span with aguy-color-red class', async () => {
      const html = await processMarkdown('::red{important}')
      expect(html).toContain('<span class="aguy-color-red">important</span>')
    })

    it('should transform ::orange{text} to span with aguy-color-orange class', async () => {
      const html = await processMarkdown('::orange{warning}')
      expect(html).toContain('<span class="aguy-color-orange">warning</span>')
    })

    it('should transform ::yellow{text} to span with aguy-color-yellow class', async () => {
      const html = await processMarkdown('::yellow{highlight}')
      expect(html).toContain('<span class="aguy-color-yellow">highlight</span>')
    })

    it('should transform ::green{text} to span with aguy-color-green class', async () => {
      const html = await processMarkdown('::green{success}')
      expect(html).toContain('<span class="aguy-color-green">success</span>')
    })

    it('should transform ::blue{text} to span with aguy-color-blue class', async () => {
      const html = await processMarkdown('::blue{info}')
      expect(html).toContain('<span class="aguy-color-blue">info</span>')
    })

    it('should transform ::purple{text} to span with aguy-color-purple class', async () => {
      const html = await processMarkdown('::purple{special}')
      expect(html).toContain('<span class="aguy-color-purple">special</span>')
    })

    it('should transform ::pink{text} to span with aguy-color-pink class', async () => {
      const html = await processMarkdown('::pink{emphasis}')
      expect(html).toContain('<span class="aguy-color-pink">emphasis</span>')
    })

    it('should transform ::gray{text} to span with aguy-color-gray class', async () => {
      const html = await processMarkdown('::gray{muted}')
      expect(html).toContain('<span class="aguy-color-gray">muted</span>')
    })
  })

  describe('Nested Markdown Support', () => {
    it('should preserve bold inside color syntax', async () => {
      const html = await processMarkdown('::red{**bold text**}')
      expect(html).toContain('<span class="aguy-color-red"><strong>bold text</strong></span>')
    })

    it('should preserve italic inside color syntax', async () => {
      const html = await processMarkdown('::blue{*italic text*}')
      expect(html).toContain('<span class="aguy-color-blue"><em>italic text</em></span>')
    })

    it('should preserve code inside color syntax', async () => {
      const html = await processMarkdown('::green{`code`}')
      expect(html).toContain('<span class="aguy-color-green"><code>code</code></span>')
    })

    it('should preserve links inside color syntax', async () => {
      const html = await processMarkdown('::purple{[link](https://example.com)}')
      expect(html).toContain('<span class="aguy-color-purple">')
      expect(html).toContain('<a href="https://example.com">link</a>')
    })

    it('should preserve mixed formatting inside color syntax', async () => {
      const html = await processMarkdown('::red{some **bold** and *italic* text}')
      expect(html).toContain('<span class="aguy-color-red">')
      expect(html).toContain('<strong>bold</strong>')
      expect(html).toContain('<em>italic</em>')
    })
  })

  describe('Unknown Color Fallback', () => {
    it('should render ::violet{} as literal text (unknown color)', async () => {
      const html = await processMarkdown('::violet{text}')
      expect(html).not.toContain('aguy-color-violet')
      expect(html).toContain('::violet{text}')
    })

    it('should render ::brown{} as literal text (unknown color)', async () => {
      const html = await processMarkdown('::brown{text}')
      expect(html).not.toContain('aguy-color-brown')
      expect(html).toContain('::brown{text}')
    })

    it('should render ::white{} as literal text (unknown color)', async () => {
      const html = await processMarkdown('::white{text}')
      expect(html).not.toContain('aguy-color-white')
      expect(html).toContain('::white{text}')
    })
  })

  describe('Multiple Tokens in One Paragraph', () => {
    it('should handle multiple color tokens in same paragraph', async () => {
      const html = await processMarkdown('This is ::red{red} and ::blue{blue} text')
      expect(html).toContain('<span class="aguy-color-red">red</span>')
      expect(html).toContain('<span class="aguy-color-blue">blue</span>')
    })

    it('should handle three tokens in same paragraph', async () => {
      const html = await processMarkdown('::red{A} then ::green{B} and ::blue{C}')
      expect(html).toContain('<span class="aguy-color-red">A</span>')
      expect(html).toContain('<span class="aguy-color-green">B</span>')
      expect(html).toContain('<span class="aguy-color-blue">C</span>')
    })
  })

  describe('Unmatched Brace Fallback', () => {
    it('should output original text when closing brace not found', async () => {
      const html = await processMarkdown('::red{no closing')
      expect(html).not.toContain('aguy-color-red')
      expect(html).toContain('::red{no closing')
    })

    it('should output original text for opening without any closing', async () => {
      const html = await processMarkdown('::blue{start but no end')
      expect(html).not.toContain('aguy-color-blue')
      expect(html).toContain('::blue{start but no end')
    })

    it('should handle nested braces correctly', async () => {
      const html = await processMarkdown('::red{outer {inner} text}')
      expect(html).toContain('<span class="aguy-color-red">outer {inner} text</span>')
    })
  })

  describe('Marker Removal Verification', () => {
    it('should remove opening marker ::red{', async () => {
      const html = await processMarkdown('::red{text}')
      expect(html).not.toContain('::red{')
      expect(html).toContain('<span class="aguy-color-red">text</span>')
    })

    it('should remove closing marker }', async () => {
      const html = await processMarkdown('::blue{content}')
      expect(html).not.toContain('}')
      expect(html).toContain('<span class="aguy-color-blue">content</span>')
    })

    it('should not show any markers in final output', async () => {
      const html = await processMarkdown('Text with ::green{colored} word')
      expect(html).not.toContain('::green{')
      expect(html).not.toMatch(/colored\}/)
      expect(html).toContain('Text with ')
      expect(html).toContain('<span class="aguy-color-green">colored</span>')
      expect(html).toContain(' word')
    })
  })

  describe('Headings and List Items', () => {
    it('should work in headings', async () => {
      const html = await processMarkdown('# Heading with ::red{colored} text')
      expect(html).toContain('<h1>')
      expect(html).toContain('<span class="aguy-color-red">colored</span>')
    })

    it('should work in list items', async () => {
      const html = await processMarkdown('- Item with ::blue{colored} text')
      expect(html).toContain('<li>')
      expect(html).toContain('<span class="aguy-color-blue">colored</span>')
    })

    it('should work in ordered lists', async () => {
      const html = await processMarkdown('1. First ::green{item}\n2. Second ::red{item}')
      expect(html).toContain('<span class="aguy-color-green">item</span>')
      expect(html).toContain('<span class="aguy-color-red">item</span>')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty content', async () => {
      const html = await processMarkdown('::red{}')
      expect(html).toContain('<span class="aguy-color-red"></span>')
    })

    it('should handle whitespace-only content', async () => {
      const html = await processMarkdown('::blue{   }')
      expect(html).toContain('<span class="aguy-color-blue">   </span>')
    })

    it('should handle adjacent tokens', async () => {
      const html = await processMarkdown('::red{A}::blue{B}')
      expect(html).toContain('<span class="aguy-color-red">A</span>')
      expect(html).toContain('<span class="aguy-color-blue">B</span>')
    })
  })
})
