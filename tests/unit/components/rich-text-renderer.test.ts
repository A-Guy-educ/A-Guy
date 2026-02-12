import { describe, expect, it } from 'vitest'
import { preprocessNewlines } from '@/ui/web/exerciserenderer/blocks/RichTextRenderer/utils'

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
    // Trailing newline should not get spaces added (no content after it)
    const expected = 'Line 1  \nLine 2\n'
    expect(preprocessNewlines(input)).toBe(expected)
  })

  it('should handle text with triple newlines (empty paragraph)', () => {
    const input = 'Line 1\n\n\nLine 2'
    const expected = 'Line 1\n\n\nLine 2'
    expect(preprocessNewlines(input)).toBe(expected)
  })

  it('should preserve existing hard breaks (two spaces + newline)', () => {
    const input = 'Line 1  \nLine 2'
    // Should not add more spaces when they already exist
    const expected = 'Line 1  \nLine 2'
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
