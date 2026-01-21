import { normalizeLatexDelimiters } from '@/components/chat/ChatMessageContent/normalize-latex'
import { describe, expect, it } from 'vitest'

describe('normalizeLatexDelimiters', () => {
  describe('block math \\[...\\]', () => {
    it('converts \\[ to $$ with newlines', () => {
      expect(normalizeLatexDelimiters('\\[')).toBe('\n$$\n')
    })

    it('converts \\] to $$ with newlines', () => {
      expect(normalizeLatexDelimiters('\\]')).toBe('\n$$\n')
    })

    it('converts full block math expression', () => {
      const input = '\\[ f(x) = \\frac{a}{b} \\]'
      const expected = '\n$$\n f(x) = \\frac{a}{b} \n$$\n'
      expect(normalizeLatexDelimiters(input)).toBe(expected)
    })

    it('converts Gaussian formula', () => {
      const input =
        '\\[ f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2} \\]'
      const expected =
        '\n$$\n f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2} \n$$\n'
      expect(normalizeLatexDelimiters(input)).toBe(expected)
    })
  })

  describe('inline math \\(...\\) converted to block', () => {
    it('converts \\( to $$ with newlines', () => {
      expect(normalizeLatexDelimiters('\\(')).toBe('\n$$\n')
    })

    it('converts \\) to $$ with newlines', () => {
      expect(normalizeLatexDelimiters('\\)')).toBe('\n$$\n')
    })

    it('converts full inline math expression to block math', () => {
      const input = 'The value is \\(x^2\\) here'
      const expected = 'The value is \n$$\nx^2\n$$\n here'
      expect(normalizeLatexDelimiters(input)).toBe(expected)
    })
  })

  describe('mixed content', () => {
    it('converts both inline and block in same content (all as block math)', () => {
      const input = 'Inline \\(a+b\\) and block:\n\\[ x^2 \\]'
      const expected = 'Inline \n$$\na+b\n$$\n and block:\n\n$$\n x^2 \n$$\n'
      expect(normalizeLatexDelimiters(input)).toBe(expected)
    })

    it('preserves Hebrew text', () => {
      const input = 'הנוסחה היא \\[ f(x) = x^2 \\]'
      const expected = 'הנוסחה היא \n$$\n f(x) = x^2 \n$$\n'
      expect(normalizeLatexDelimiters(input)).toBe(expected)
    })
  })

  describe('already normalized content', () => {
    it('leaves $...$ unchanged', () => {
      const input = '$x^2$'
      expect(normalizeLatexDelimiters(input)).toBe(input)
    })

    it('leaves $$...$$ unchanged', () => {
      const input = '$$\\frac{a}{b}$$'
      expect(normalizeLatexDelimiters(input)).toBe(input)
    })

    it('leaves plain text unchanged', () => {
      const input = 'Hello world'
      expect(normalizeLatexDelimiters(input)).toBe(input)
    })
  })

  describe('JSON-escaped backslashes', () => {
    it('converts JSON-escaped \\[ to $$', () => {
      // Double backslash - JSON escaped version
      expect(normalizeLatexDelimiters('\\\\[')).toBe('\n$$\n')
    })

    it('converts JSON-escaped \\] to $$', () => {
      expect(normalizeLatexDelimiters('\\\\]')).toBe('\n$$\n')
    })

    it('converts full JSON-escaped block math expression', () => {
      const input = '\\\\[ f(x) = x^2 \\\\]'
      const expected = '\n$$\n f(x) = x^2 \n$$\n'
      expect(normalizeLatexDelimiters(input)).toBe(expected)
    })

    it('converts JSON-escaped \\( to $$ with newlines', () => {
      expect(normalizeLatexDelimiters('\\\\(')).toBe('\n$$\n')
    })

    it('converts JSON-escaped \\) to $$ with newlines', () => {
      expect(normalizeLatexDelimiters('\\\\)')).toBe('\n$$\n')
    })

    it('converts full JSON-escaped inline math expression to block math', () => {
      const input = 'The value is \\\\(x^2\\\\) here'
      const expected = 'The value is \n$$\nx^2\n$$\n here'
      expect(normalizeLatexDelimiters(input)).toBe(expected)
    })
  })

  describe('triple-escaped backslashes (LLM over-escaping)', () => {
    it('converts triple-escaped \\\\\\[ to $$', () => {
      expect(normalizeLatexDelimiters('\\\\\\[')).toBe('\n$$\n')
    })

    it('converts triple-escaped \\\\\\] to $$', () => {
      expect(normalizeLatexDelimiters('\\\\\\]')).toBe('\n$$\n')
    })

    it('converts triple-escaped inline delimiters to block math', () => {
      expect(normalizeLatexDelimiters('\\\\\\(')).toBe('\n$$\n')
      expect(normalizeLatexDelimiters('\\\\\\)')).toBe('\n$$\n')
    })

    it('normalizes over-escaped LaTeX commands (\\\\frac → \\frac)', () => {
      const input = '\\\\frac{a}{b}'
      const expected = '\\frac{a}{b}'
      expect(normalizeLatexDelimiters(input)).toBe(expected)
    })

    it('normalizes escaped equals (\\= → =)', () => {
      const input = 'f(x) \\= y'
      const expected = 'f(x) = y'
      expect(normalizeLatexDelimiters(input)).toBe(expected)
    })

    it('converts full triple-escaped Gaussian formula from LLM', () => {
      // This is the exact format from the user's issue
      const input =
        '\\\\\\[ f(x) \\= \\\\frac{1}{\\\\sigma\\\\sqrt{2\\\\pi}} e^{-\\\\frac{1}{2}\\\\left(\\\\frac{x-\\\\mu}{\\\\sigma}\\\\right)^2} \\\\\\]'
      const expected =
        '\n$$\n f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2} \n$$\n'
      expect(normalizeLatexDelimiters(input)).toBe(expected)
    })
  })

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(normalizeLatexDelimiters('')).toBe('')
    })

    it('handles null/undefined', () => {
      expect(normalizeLatexDelimiters(null as unknown as string)).toBe(null)
      expect(normalizeLatexDelimiters(undefined as unknown as string)).toBe(undefined)
    })

    it('handles multiple block expressions', () => {
      const input = '\\[ a \\] and \\[ b \\]'
      const expected = '\n$$\n a \n$$\n and \n$$\n b \n$$\n'
      expect(normalizeLatexDelimiters(input)).toBe(expected)
    })
  })
})
