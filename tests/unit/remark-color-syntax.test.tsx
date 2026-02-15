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
function renderColorMarkdown(content: string) {
  return render(<MathMarkdown content={content} />)
}

describe('remarkColorSyntax - Basic Parsing', () => {
  it('should parse ::red{text} and render with aguy-color-red class', () => {
    const { container } = renderColorMarkdown('::red{important text}')
    const redSpan = container.querySelector('.aguy-color-red')
    expect(redSpan).not.toBeNull()
    expect(redSpan?.textContent).toBe('important text')
  })

  it('should parse ::orange{text} and render with aguy-color-orange class', () => {
    const { container } = renderColorMarkdown('::orange{warning text}')
    const orangeSpan = container.querySelector('.aguy-color-orange')
    expect(orangeSpan).not.toBeNull()
    expect(orangeSpan?.textContent).toBe('warning text')
  })

  it('should parse ::yellow{text} and render with aguy-color-yellow class', () => {
    const { container } = renderColorMarkdown('::yellow{highlighted text}')
    const yellowSpan = container.querySelector('.aguy-color-yellow')
    expect(yellowSpan).not.toBeNull()
    expect(yellowSpan?.textContent).toBe('highlighted text')
  })

  it('should parse ::green{text} and render with aguy-color-green class', () => {
    const { container } = renderColorMarkdown('::green{success message}')
    const greenSpan = container.querySelector('.aguy-color-green')
    expect(greenSpan).not.toBeNull()
    expect(greenSpan?.textContent).toBe('success message')
  })

  it('should parse ::blue{text} and render with aguy-color-blue class', () => {
    const { container } = renderColorMarkdown('::blue{information}')
    const blueSpan = container.querySelector('.aguy-color-blue')
    expect(blueSpan).not.toBeNull()
    expect(blueSpan?.textContent).toBe('information')
  })

  it('should parse ::purple{text} and render with aguy-color-purple class', () => {
    const { container } = renderColorMarkdown('::purple{special note}')
    const purpleSpan = container.querySelector('.aguy-color-purple')
    expect(purpleSpan).not.toBeNull()
    expect(purpleSpan?.textContent).toBe('special note')
  })

  it('should parse ::pink{text} and render with aguy-color-pink class', () => {
    const { container } = renderColorMarkdown('::pink{emphasis}')
    const pinkSpan = container.querySelector('.aguy-color-pink')
    expect(pinkSpan).not.toBeNull()
    expect(pinkSpan?.textContent).toBe('emphasis')
  })

  it('should parse ::gray{text} and render with aguy-color-gray class', () => {
    const { container } = renderColorMarkdown('::gray{muted text}')
    const graySpan = container.querySelector('.aguy-color-gray')
    expect(graySpan).not.toBeNull()
    expect(graySpan?.textContent).toBe('muted text')
  })
})

describe('remarkColorSyntax - Nested Markdown', () => {
  it('should support bold text inside color syntax', () => {
    const { container } = renderColorMarkdown('::red{**bold text**}')
    const redSpan = container.querySelector('.aguy-color-red')
    expect(redSpan).not.toBeNull()
    expect(redSpan?.querySelector('strong')).not.toBeNull()
  })

  it('should support italic text inside color syntax', () => {
    const { container } = renderColorMarkdown('::blue{*italic text*}')
    const blueSpan = container.querySelector('.aguy-color-blue')
    expect(blueSpan).not.toBeNull()
    expect(blueSpan?.querySelector('em')).not.toBeNull()
  })

  it('should support mixed formatting inside color syntax', () => {
    const { container } = renderColorMarkdown('::green{some **bold** and *italic* text}')
    const greenSpan = container.querySelector('.aguy-color-green')
    expect(greenSpan).not.toBeNull()
    expect(greenSpan?.querySelector('strong')).not.toBeNull()
    expect(greenSpan?.querySelector('em')).not.toBeNull()
  })

  it('should support code inside color syntax', () => {
    const { container } = renderColorMarkdown('::red{`code snippet`}')
    const redSpan = container.querySelector('.aguy-color-red')
    expect(redSpan).not.toBeNull()
    expect(redSpan?.querySelector('code')).not.toBeNull()
  })

  it('should support links inside color syntax', () => {
    const { container } = renderColorMarkdown('::blue{[click here](https://example.com)}')
    const blueSpan = container.querySelector('.aguy-color-blue')
    expect(blueSpan).not.toBeNull()
    const link = blueSpan?.querySelector('a')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('href')).toBe('https://example.com')
  })
})

describe('remarkColorSyntax - Unknown Color Fallback', () => {
  it('should render unknown color as literal text', () => {
    const { container } = renderColorMarkdown('::violet{text}')
    // Should not have any color class
    expect(container.querySelector('.aguy-color-violet')).toBeNull()
    // Should render as literal text
    expect(container.textContent).toContain('::violet{text}')
  })

  it('should render ::brown{} as literal text', () => {
    const { container } = renderColorMarkdown('::brown{warning}')
    expect(container.querySelector('.aguy-color-brown')).toBeNull()
    expect(container.textContent).toContain('::brown{warning}')
  })

  it('should render ::white{} as literal text', () => {
    const { container } = renderColorMarkdown('::white{alert}')
    expect(container.querySelector('.aguy-color-white')).toBeNull()
    expect(container.textContent).toContain('::white{alert}')
  })
})

describe('remarkColorSyntax - Multiple Tokens', () => {
  it('should handle multiple color tokens in one paragraph', () => {
    const { container } = renderColorMarkdown(
      'This is ::red{red} and ::blue{blue} and ::green{green}',
    )
    expect(container.querySelector('.aguy-color-red')).not.toBeNull()
    expect(container.querySelector('.aguy-color-blue')).not.toBeNull()
    expect(container.querySelector('.aguy-color-green')).not.toBeNull()
  })

  it('should handle adjacent color tokens', () => {
    const { container } = renderColorMarkdown('::red{first}::blue{second}')
    expect(container.querySelector('.aguy-color-red')).not.toBeNull()
    expect(container.querySelector('.aguy-color-blue')).not.toBeNull()
  })

  it('should handle color tokens with text in between', () => {
    const { container } = renderColorMarkdown('Start ::red{important} middle ::blue{info} end')
    expect(container.textContent).toContain('Start')
    expect(container.querySelector('.aguy-color-red')).not.toBeNull()
    expect(container.textContent).toContain('middle')
    expect(container.querySelector('.aguy-color-blue')).not.toBeNull()
    expect(container.textContent).toContain('end')
  })
})

describe('remarkColorSyntax - Unmatched Braces', () => {
  it('should handle unmatched opening brace', () => {
    const { container } = renderColorMarkdown('::red{text without closing')
    // Should render as literal text since brace is unmatched
    expect(container.textContent).toContain('::red{text without closing')
  })

  it('should handle text with nested braces', () => {
    const { container } = renderColorMarkdown('::red{outer {inner} text}')
    // Should handle nested braces correctly
    const redSpan = container.querySelector('.aguy-color-red')
    expect(redSpan).not.toBeNull()
    expect(redSpan?.textContent).toContain('outer {inner} text')
  })

  it('should handle empty color syntax', () => {
    const { container } = renderColorMarkdown('::red{}')
    expect(container.querySelector('.aguy-color-red')).not.toBeNull()
  })
})

describe('remarkColorSyntax - Handler Whitelist Enforcement', () => {
  it('should only generate spans for whitelisted colors', () => {
    const { container } = renderColorMarkdown('::red{red} ::blue{blue} ::green{green}')

    // Count the number of aguy-color spans
    const redSpans = container.querySelectorAll('.aguy-color-red')
    const blueSpans = container.querySelectorAll('.aguy-color-blue')
    const greenSpans = container.querySelectorAll('.aguy-color-green')

    expect(redSpans.length).toBe(1)
    expect(blueSpans.length).toBe(1)
    expect(greenSpans.length).toBe(1)
  })

  it('should not generate inline styles', () => {
    const { container } = renderColorMarkdown('::red{text}')
    const redSpan = container.querySelector('.aguy-color-red')
    // Should NOT contain style attribute
    expect(redSpan?.getAttribute('style')).toBeNull()
  })

  it('should only use class attribute for styling', () => {
    const { container } = renderColorMarkdown('::blue{text}')
    const blueSpan = container.querySelector('.aguy-color-blue')
    // Should only have class attribute, not style or data-color
    expect(blueSpan).not.toBeNull()
    expect(blueSpan?.getAttribute('style')).toBeNull()
    expect(blueSpan?.getAttribute('data-color')).toBeNull()
  })
})

describe('remarkColorSyntax - Edge Cases', () => {
  it('should handle empty string', () => {
    const { container } = renderColorMarkdown('')
    expect(container.querySelector('.aguy-color-red')).toBeNull()
  })

  it('should handle text with no color syntax', () => {
    const { container } = renderColorMarkdown('Just plain text')
    expect(container.textContent).toContain('Just plain text')
    expect(container.querySelector('[class*="aguy-color"]')).toBeNull()
  })

  it('should handle color syntax at start of text', () => {
    const { container } = renderColorMarkdown('::red{start} middle end')
    expect(container.querySelector('.aguy-color-red')).not.toBeNull()
  })

  it('should handle color syntax at end of text', () => {
    const { container } = renderColorMarkdown('start middle ::green{end}')
    expect(container.querySelector('.aguy-color-green')).not.toBeNull()
  })

  it('should handle multiple paragraphs with color syntax', () => {
    const { container } = renderColorMarkdown('::red{First paragraph}\n\n::blue{Second paragraph}')
    expect(container.querySelector('.aguy-color-red')).not.toBeNull()
    expect(container.querySelector('.aguy-color-blue')).not.toBeNull()
  })
})

describe('remarkColorSyntax - Marker Removal', () => {
  it('should not render opening marker :: in output', () => {
    const { container } = renderColorMarkdown('::red{hello}')
    // Should not contain the :: marker
    expect(container.textContent).not.toContain('::red')
    expect(container.textContent).not.toContain('::')
    expect(container.textContent).toContain('hello')
  })

  it('should not render opening brace { in output', () => {
    const { container } = renderColorMarkdown('::blue{world}')
    const blueSpan = container.querySelector('.aguy-color-blue')
    expect(blueSpan?.textContent).toBe('world')
    // The visible text should not contain the opening brace
    expect(container.textContent).not.toContain('::blue{')
  })

  it('should not render closing brace } for color syntax', () => {
    const { container } = renderColorMarkdown('::green{test}')
    const greenSpan = container.querySelector('.aguy-color-green')
    expect(greenSpan?.textContent).toBe('test')
    // Should not have trailing brace
    expect(greenSpan?.textContent).not.toContain('}')
  })

  it('should remove all markers in nested markdown case', () => {
    const { container } = renderColorMarkdown('::red{**bold text**}')
    const redSpan = container.querySelector('.aguy-color-red')
    // Should have the bold element but no markers
    expect(redSpan?.querySelector('strong')).not.toBeNull()
    expect(redSpan?.querySelector('strong')?.textContent).toBe('bold text')
    // Should not contain any markers
    expect(container.textContent).not.toContain('::red')
    expect(container.textContent).not.toContain('{')
    expect(container.textContent).not.toContain('}')
  })

  it('should preserve nested braces inside content', () => {
    const { container } = renderColorMarkdown('::red{code {x} here}')
    const redSpan = container.querySelector('.aguy-color-red')
    // The nested braces should be preserved
    expect(redSpan?.textContent).toContain('{x}')
    // But not the outer marker braces
    expect(container.textContent).not.toContain('::red{')
  })
})
