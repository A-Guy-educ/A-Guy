// @vitest-environment jsdom
/**
 * Unit tests for remark-color-syntax plugin
 */

import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'
import React from 'react'

/**
 * Helper function to render markdown with the color syntax plugin
 * We'll wire this up after updating MathMarkdown to accept the plugin
 */
function renderHighlightMarkdown(content: string) {
  return render(<MathMarkdown content={content} />)
}

describe('remarkColorSyntax - Basic Parsing', () => {
  it('should parse ::text-highlight-1{text} and render with aguy-text-highlight-1 class', () => {
    const { container } = renderHighlightMarkdown('::text-highlight-1{important text}')
    const redSpan = container.querySelector('.aguy-text-highlight-1')
    expect(redSpan).not.toBeNull()
    expect(redSpan?.textContent).toBe('important text')
  })

  it('should parse ::text-highlight-2{text} and render with aguy-text-highlight-2 class', () => {
    const { container } = renderHighlightMarkdown('::text-highlight-2{warning text}')
    const highlight2Span = container.querySelector('.aguy-text-highlight-2')
    expect(highlight2Span).not.toBeNull()
    expect(highlight2Span?.textContent).toBe('warning text')
  })

  it('should parse ::text-highlight-3{text} and render with aguy-text-highlight-3 class', () => {
    const { container } = renderHighlightMarkdown('::text-highlight-3{highlighted text}')
    const highlight3Span = container.querySelector('.aguy-text-highlight-3')
    expect(highlight3Span).not.toBeNull()
    expect(highlight3Span?.textContent).toBe('highlighted text')
  })

  it('should parse ::text-highlight-4{text} and render with aguy-text-highlight-4 class', () => {
    const { container } = renderHighlightMarkdown('::text-highlight-4{success message}')
    const greenSpan = container.querySelector('.aguy-text-highlight-4')
    expect(greenSpan).not.toBeNull()
    expect(greenSpan?.textContent).toBe('success message')
  })

  it('should parse ::text-highlight-5{text} and render with aguy-text-highlight-5 class', () => {
    const { container } = renderHighlightMarkdown('::text-highlight-5{information}')
    const highlight5Span = container.querySelector('.aguy-text-highlight-5')
    expect(highlight5Span).not.toBeNull()
    expect(highlight5Span?.textContent).toBe('information')
  })

  it('should parse ::text-highlight-6{text} and render with aguy-text-highlight-6 class', () => {
    const { container } = renderHighlightMarkdown('::text-highlight-6{special note}')
    const highlight6Span = container.querySelector('.aguy-text-highlight-6')
    expect(highlight6Span).not.toBeNull()
    expect(highlight6Span?.textContent).toBe('special note')
  })

  it('should parse ::text-highlight-7{text} and render with aguy-text-highlight-7 class', () => {
    const { container } = renderHighlightMarkdown('::text-highlight-7{emphasis}')
    const highlight7Span = container.querySelector('.aguy-text-highlight-7')
    expect(highlight7Span).not.toBeNull()
    expect(highlight7Span?.textContent).toBe('emphasis')
  })

  it('should parse ::text-highlight-8{text} and render with aguy-text-highlight-8 class', () => {
    const { container } = renderHighlightMarkdown('::text-highlight-8{muted text}')
    const highlight8Span = container.querySelector('.aguy-text-highlight-8')
    expect(highlight8Span).not.toBeNull()
    expect(highlight8Span?.textContent).toBe('muted text')
  })
})

describe('remarkColorSyntax - Cross-Node Behavior (Does NOT Transform)', () => {
  it('should NOT transform when bold markdown creates separate nodes', () => {
    // Bold syntax ** ** causes markdown to create separate nodes before our plugin runs
    // Since opening and closing are not in same text node, it stays literal
    const { container } = renderHighlightMarkdown('::text-highlight-1{**bold text**}')
    const redSpan = container.querySelector('.aguy-text-highlight-1')
    // Should NOT find the highlight span because bold creates separate nodes
    expect(redSpan).toBeNull()
    // Should see the literal text with markdown-rendered bold
    expect(container.textContent).toContain('::text-highlight-1{')
    expect(container.querySelector('strong')?.textContent).toBe('bold text')
  })

  it('should NOT transform when italic markdown creates separate nodes', () => {
    const { container } = renderHighlightMarkdown('::text-highlight-5{*italic text*}')
    const highlight5Span = container.querySelector('.aguy-text-highlight-5')
    expect(highlight5Span).toBeNull()
    expect(container.textContent).toContain('::text-highlight-5{')
    expect(container.querySelector('em')?.textContent).toBe('italic text')
  })

  it('should NOT transform when code markdown creates separate nodes', () => {
    const { container } = renderHighlightMarkdown('::text-highlight-1{`code snippet`}')
    const redSpan = container.querySelector('.aguy-text-highlight-1')
    expect(redSpan).toBeNull()
    expect(container.textContent).toContain('::text-highlight-1{')
    expect(container.querySelector('code')?.textContent).toBe('code snippet')
  })

  it('should NOT transform when link markdown creates separate nodes', () => {
    const { container } = renderHighlightMarkdown(
      '::text-highlight-5{[click here](https://example.com)}',
    )
    const highlight5Span = container.querySelector('.aguy-text-highlight-5')
    expect(highlight5Span).toBeNull()
    expect(container.textContent).toContain('::text-highlight-5{')
    const link = container.querySelector('a')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('href')).toBe('https://example.com')
  })
})

describe('remarkColorSyntax - Unknown Color Fallback', () => {
  it('should render unknown color as literal text', () => {
    const { container } = renderHighlightMarkdown('::violet{text}')
    // Should not have any color class
    expect(container.querySelector('.aguy-color-violet')).toBeNull()
    // Should render as literal text
    expect(container.textContent).toContain('::violet{text}')
  })

  it('should render ::brown{} as literal text', () => {
    const { container } = renderHighlightMarkdown('::brown{warning}')
    expect(container.querySelector('.aguy-color-brown')).toBeNull()
    expect(container.textContent).toContain('::brown{warning}')
  })

  it('should render ::white{} as literal text', () => {
    const { container } = renderHighlightMarkdown('::white{alert}')
    expect(container.querySelector('.aguy-color-white')).toBeNull()
    expect(container.textContent).toContain('::white{alert}')
  })
})

describe('remarkColorSyntax - Multiple Tokens', () => {
  it('should handle multiple color tokens in one paragraph', () => {
    const { container } = renderHighlightMarkdown(
      'This is ::text-highlight-1{red} and ::text-highlight-5{blue} and ::text-highlight-4{green}',
    )
    expect(container.querySelector('.aguy-text-highlight-1')).not.toBeNull()
    expect(container.querySelector('.aguy-text-highlight-5')).not.toBeNull()
    expect(container.querySelector('.aguy-text-highlight-4')).not.toBeNull()
  })

  it('should handle adjacent color tokens', () => {
    const { container } = renderHighlightMarkdown(
      '::text-highlight-1{first}::text-highlight-5{second}',
    )
    expect(container.querySelector('.aguy-text-highlight-1')).not.toBeNull()
    expect(container.querySelector('.aguy-text-highlight-5')).not.toBeNull()
  })

  it('should handle color tokens with text in between', () => {
    const { container } = renderHighlightMarkdown(
      'Start ::text-highlight-1{important} middle ::text-highlight-5{info} end',
    )
    expect(container.textContent).toContain('Start')
    expect(container.querySelector('.aguy-text-highlight-1')).not.toBeNull()
    expect(container.textContent).toContain('middle')
    expect(container.querySelector('.aguy-text-highlight-5')).not.toBeNull()
    expect(container.textContent).toContain('end')
  })
})

describe('remarkColorSyntax - Unmatched Braces', () => {
  it('should handle unmatched opening brace', () => {
    const { container } = renderHighlightMarkdown('::text-highlight-1{text without closing')
    // Should render as literal text since brace is unmatched
    expect(container.textContent).toContain('::text-highlight-1{text without closing')
  })

  it('should handle text with nested braces (takes first } as closing)', () => {
    const { container } = renderHighlightMarkdown('::text-highlight-1{outer {inner} text}')
    // With simplified plugin, takes FIRST } as closing brace
    const redSpan = container.querySelector('.aguy-text-highlight-1')
    expect(redSpan).not.toBeNull()
    // Only captures up to first }, remaining text stays outside
    expect(redSpan?.textContent).toBe('outer {inner')
    expect(container.textContent).toContain('} text}')
  })

  it('should handle empty color syntax', () => {
    const { container } = renderHighlightMarkdown('::text-highlight-1{}')
    expect(container.querySelector('.aguy-text-highlight-1')).not.toBeNull()
  })
})

describe('remarkColorSyntax - Handler Whitelist Enforcement', () => {
  it('should only generate spans for whitelisted colors', () => {
    const { container } = renderHighlightMarkdown(
      '::text-highlight-1{red} ::text-highlight-5{blue} ::text-highlight-4{green}',
    )

    // Count the number of aguy-color spans
    const redSpans = container.querySelectorAll('.aguy-text-highlight-1')
    const highlight5Spans = container.querySelectorAll('.aguy-text-highlight-5')
    const greenSpans = container.querySelectorAll('.aguy-text-highlight-4')

    expect(redSpans.length).toBe(1)
    expect(highlight5Spans.length).toBe(1)
    expect(greenSpans.length).toBe(1)
  })

  it('should not generate inline styles', () => {
    const { container } = renderHighlightMarkdown('::text-highlight-1{text}')
    const redSpan = container.querySelector('.aguy-text-highlight-1')
    // Should NOT contain style attribute
    expect(redSpan?.getAttribute('style')).toBeNull()
  })

  it('should only use class attribute for styling', () => {
    const { container } = renderHighlightMarkdown('::text-highlight-5{text}')
    const highlight5Span = container.querySelector('.aguy-text-highlight-5')
    // Should only have class attribute, not style or data-color
    expect(highlight5Span).not.toBeNull()
    expect(highlight5Span?.getAttribute('style')).toBeNull()
    expect(highlight5Span?.getAttribute('data-color')).toBeNull()
  })
})

describe('remarkColorSyntax - Edge Cases', () => {
  it('should handle empty string', () => {
    const { container } = renderHighlightMarkdown('')
    expect(container.querySelector('.aguy-text-highlight-1')).toBeNull()
  })

  it('should handle text with no color syntax', () => {
    const { container } = renderHighlightMarkdown('Just plain text')
    expect(container.textContent).toContain('Just plain text')
    expect(container.querySelector('[class*="aguy-color"]')).toBeNull()
  })

  it('should handle color syntax at start of text', () => {
    const { container } = renderHighlightMarkdown('::text-highlight-1{start} middle end')
    expect(container.querySelector('.aguy-text-highlight-1')).not.toBeNull()
  })

  it('should handle color syntax at end of text', () => {
    const { container } = renderHighlightMarkdown('start middle ::text-highlight-4{end}')
    expect(container.querySelector('.aguy-text-highlight-4')).not.toBeNull()
  })

  it('should handle multiple paragraphs with color syntax', () => {
    const { container } = renderHighlightMarkdown(
      '::text-highlight-1{First paragraph}\n\n::text-highlight-5{Second paragraph}',
    )
    expect(container.querySelector('.aguy-text-highlight-1')).not.toBeNull()
    expect(container.querySelector('.aguy-text-highlight-5')).not.toBeNull()
  })
})

describe('remarkColorSyntax - Marker Removal', () => {
  it('should not render opening marker :: in output', () => {
    const { container } = renderHighlightMarkdown('::text-highlight-1{hello}')
    // Should not contain the :: marker
    expect(container.textContent).not.toContain('::red')
    expect(container.textContent).not.toContain('::')
    expect(container.textContent).toContain('hello')
  })

  it('should not render opening brace { in output', () => {
    const { container } = renderHighlightMarkdown('::text-highlight-5{world}')
    const highlight5Span = container.querySelector('.aguy-text-highlight-5')
    expect(highlight5Span?.textContent).toBe('world')
    // The visible text should not contain the opening brace
    expect(container.textContent).not.toContain('::text-highlight-5{')
  })

  it('should not render closing brace } for color syntax', () => {
    const { container } = renderHighlightMarkdown('::text-highlight-4{test}')
    const greenSpan = container.querySelector('.aguy-text-highlight-4')
    expect(greenSpan?.textContent).toBe('test')
    // Should not have trailing brace
    expect(greenSpan?.textContent).not.toContain('}')
  })

  it('should handle content with braces by taking first closing brace', () => {
    // Since we take the first } we find, content with braces will be cut at first }
    // This is expected behavior for the simplified plugin
    const { container } = renderHighlightMarkdown('::text-highlight-1{code {x} here}')
    const redSpan = container.querySelector('.aguy-text-highlight-1')
    expect(redSpan).not.toBeNull()
    // Takes content up to first closing brace, so "code {x" is captured
    expect(redSpan?.textContent).toBe('code {x')
    // The rest " here}" becomes literal text after
    expect(container.textContent).toContain(' here}')
  })
})
