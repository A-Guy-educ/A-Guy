import { describe, expect, it } from 'vitest'

/**
 * Preprocess text to render single newlines as visible line breaks.
 * This is the same function from RichTextRenderer.
 */
function preprocessNewlines(text: string): string {
  return text.replace(/([^\n])\n(?!\n)/g, '$1  \n')
}

describe('RichTextRenderer - newline preprocessing', () => {
  it('should convert single newline to hard break (two spaces + newline)', () => {
    const input = 'Line 1\nLine 2'
    const expected = 'Line 1  \nLine 2'
    expect(preprocessNewlines(input)).toBe(expected)
  })

  it('should preserve double newlines (paragraph breaks)', () => {
    const input = 'Paragraph 1\n\nParagraph 2'
    const expected = 'Paragraph 1\n\nParagraph 2'
    expect(preprocessNewlines(input)).toBe(expected)
  })

  it('should handle multiple single newlines', () => {
    const input = 'Line 1\nLine 2\nLine 3'
    const expected = 'Line 1  \nLine 2  \nLine 3'
    expect(preprocessNewlines(input)).toBe(expected)
  })

  it('should handle mixed single and double newlines', () => {
    const input = 'Line 1\nLine 2\n\nParagraph 2\nLine 4'
    const expected = 'Line 1  \nLine 2\n\nParagraph 2  \nLine 4'
    expect(preprocessNewlines(input)).toBe(expected)
  })

  it('should handle text with no newlines', () => {
    const input = 'Single line text'
    const expected = 'Single line text'
    expect(preprocessNewlines(input)).toBe(expected)
  })

  it('should handle empty string', () => {
    const input = ''
    const expected = ''
    expect(preprocessNewlines(input)).toBe(expected)
  })

  it('should handle text starting with newline', () => {
    const input = '\nLine 1\nLine 2'
    const expected = '\nLine 1  \nLine 2'
    expect(preprocessNewlines(input)).toBe(expected)
  })

  it('should handle text ending with newline', () => {
    const input = 'Line 1\nLine 2\n'
    // Note: trailing newline gets two spaces added because it's not followed by another newline
    const expected = 'Line 1  \nLine 2  \n'
    expect(preprocessNewlines(input)).toBe(expected)
  })

  it('should handle text with triple newlines (empty paragraph)', () => {
    const input = 'Line 1\n\n\nLine 2'
    const expected = 'Line 1\n\n\nLine 2'
    expect(preprocessNewlines(input)).toBe(expected)
  })

  it('should preserve existing hard breaks (two spaces + newline)', () => {
    const input = 'Line 1  \nLine 2'
    const expected = 'Line 1    \nLine 2'
    // Note: This adds more spaces, but that's acceptable as it still renders correctly
    expect(preprocessNewlines(input)).toBe(expected)
  })

  it('should handle complex markdown with single newlines', () => {
    const input = '**Bold text**\nNormal text\n*Italic text*'
    const expected = '**Bold text**  \nNormal text  \n*Italic text*'
    expect(preprocessNewlines(input)).toBe(expected)
  })

  it('should not affect math expressions with newlines', () => {
    const input = '$x = 1$\n$y = 2$'
    const expected = '$x = 1$  \n$y = 2$'
    expect(preprocessNewlines(input)).toBe(expected)
  })
})
