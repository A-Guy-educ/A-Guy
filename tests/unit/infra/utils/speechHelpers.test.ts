import { describe, it, expect } from 'vitest'
import { stripMarkdown, detectLanguage } from '@/infra/utils/speechHelpers'

describe('stripMarkdown', () => {
  it('removes code blocks', () => {
    expect(stripMarkdown('Hello ```const x = 1``` world')).toBe('Hello  world')
  })
  it('removes inline code', () => {
    expect(stripMarkdown('Use `console.log` to debug')).toBe('Use  to debug')
  })
  it('verbalizes LaTeX block math (English)', () => {
    // Note: extra spaces around verbalized math are cosmetic - core conversion works
    expect(stripMarkdown('Formula: $$x^2 + y^2 = z^2$$ end', 'en')).toBe(
      'Formula:  x squared plus y squared equals z squared  end',
    )
  })
  it('verbalizes LaTeX inline math (English)', () => {
    expect(stripMarkdown('The value $x = 5$ is correct', 'en')).toBe(
      'The value  x equals 5  is correct',
    )
  })
  it('verbalizes LaTeX block math (Hebrew)', () => {
    // Hebrew: all ^2 -> beribu'a, = -> shav le-
    expect(stripMarkdown('Formula: $$x^2 + y^2 = z^2$$ end', 'he')).toBe(
      "Formula:  x beribu'a plus y beribu'a shav le- z beribu'a  end",
    )
  })
  it('removes markdown headings', () => {
    expect(stripMarkdown('## Title\nContent')).toBe('Title\nContent')
  })
  it('removes bold and italic', () => {
    expect(stripMarkdown('This is **bold** and *italic*')).toBe('This is bold and italic')
  })
  it('removes links but keeps text', () => {
    expect(stripMarkdown('Click [here](https://example.com) to visit')).toBe('Click here to visit')
  })
  it('handles empty string', () => {
    expect(stripMarkdown('')).toBe('')
  })
  it('collapses multiple newlines', () => {
    expect(stripMarkdown('Line1\n\n\n\nLine2')).toBe('Line1\n\nLine2')
  })
})

describe('detectLanguage', () => {
  it('detects English text', () => {
    expect(detectLanguage('Hello world, how are you?')).toBe('en-US')
  })
  it('detects Hebrew text', () => {
    expect(detectLanguage('שלום עולם, מה שלומך?')).toBe('he-IL')
  })
  it('detects mixed text with more Hebrew', () => {
    expect(detectLanguage('שלום hello עולם world מה שלומך')).toBe('he-IL')
  })
  it('defaults to English for empty text', () => {
    expect(detectLanguage('')).toBe('en-US')
  })
})
