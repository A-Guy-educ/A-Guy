import { normalizeLatexDelimiters } from '@/ui/web/chat/ChatMessageContent/normalize-latex'
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

  describe('inline math \\(...\\) preserved as inline', () => {
    it('converts \\( to $', () => {
      expect(normalizeLatexDelimiters('\\(')).toBe('$')
    })

    it('converts \\) to $', () => {
      expect(normalizeLatexDelimiters('\\)')).toBe('$')
    })

    it('converts full inline math expression to inline $...$', () => {
      const input = 'The value is \\(x^2\\) here'
      const expected = 'The value is $x^2$ here'
      expect(normalizeLatexDelimiters(input)).toBe(expected)
    })
  })

  describe('mixed content', () => {
    it('converts inline as $ and block as $$', () => {
      const input = 'Inline \\(a+b\\) and block:\n\\[ x^2 \\]'
      const expected = 'Inline $a+b$ and block:\n\n$$\n x^2 \n$$\n'
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

    it('converts JSON-escaped \\( to $', () => {
      expect(normalizeLatexDelimiters('\\\\(')).toBe('$')
    })

    it('converts JSON-escaped \\) to $', () => {
      expect(normalizeLatexDelimiters('\\\\)')).toBe('$')
    })

    it('converts full JSON-escaped inline math expression to inline $', () => {
      const input = 'The value is \\\\(x^2\\\\) here'
      const expected = 'The value is $x^2$ here'
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

    it('converts triple-escaped inline delimiters to inline $', () => {
      expect(normalizeLatexDelimiters('\\\\\\(')).toBe('$')
      expect(normalizeLatexDelimiters('\\\\\\)')).toBe('$')
    })

    it('normalizes over-escaped LaTeX commands (\\\\frac → \\frac) and wraps in $', () => {
      const input = '\\\\frac{a}{b}'
      // After normalization: \frac{a}{b}, then bare LaTeX wrapping adds $...$
      const expected = '$\\frac{a}{b}$'
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

  describe('bare bracket LaTeX (no backslash before [)', () => {
    it('converts bare [ with LaTeX commands to $$ block math', () => {
      // This is the EXACT pattern from the bug report
      const input = '[ 2 \\cdot (1 \\frac{2}{13} + 1)'
      const result = normalizeLatexDelimiters(input)
      // Should contain $$ delimiters, not raw brackets
      expect(result).toContain('$$')
      expect(result).not.toMatch(/^\[/) // Should not start with bare [
    })

    it('converts bare [ ... ] with LaTeX commands to block math', () => {
      const input = '[ \\frac{a}{b} + \\sqrt{c} ]'
      const result = normalizeLatexDelimiters(input)
      expect(result).toContain('$$')
      expect(result).toContain('\\frac{a}{b} + \\sqrt{c}')
    })

    it('does NOT convert regular markdown brackets without LaTeX', () => {
      // Regular markdown link — should NOT be converted
      const input = '[click here](https://example.com)'
      expect(normalizeLatexDelimiters(input)).toBe(input)
    })

    it('does NOT convert plain bracket text', () => {
      // Plain text in brackets — no LaTeX commands inside
      const input = '[see note 1]'
      expect(normalizeLatexDelimiters(input)).toBe(input)
    })

    it('converts bare bracket at line start with fraction', () => {
      const input = 'הנוסחה:\n[ 2 \\cdot (1 \\frac{2}{13} + 1) ]'
      const result = normalizeLatexDelimiters(input)
      expect(result).toContain('$$')
    })

    it('handles bare bracket with unclosed expression (no closing ])', () => {
      // The bug report shows expressions without closing bracket
      const input = '[ 2 \\cdot (1 \\frac{2}{13} + 1)'
      const result = normalizeLatexDelimiters(input)
      expect(result).toContain('$$')
    })
  })

  describe('bare bracket edge cases', () => {
    it('handles multiple bare bracket expressions in one string', () => {
      const input = 'First: [ \\frac{1}{2} ] and second: [ \\sqrt{3} ]'
      const result = normalizeLatexDelimiters(input)
      // Both should be converted
      expect(result.match(/\$\$/g)?.length).toBeGreaterThanOrEqual(4) // 2 open + 2 close
    })

    it('handles bare bracket mixed with backslash-bracket', () => {
      const input = '[ \\frac{a}{b} ] and \\[ c^2 \\]'
      const result = normalizeLatexDelimiters(input)
      expect(result).toContain('$$')
      expect(result).not.toContain('[')
    })

    it('preserves array index brackets [0]', () => {
      const input = 'array[0] = 5'
      expect(normalizeLatexDelimiters(input)).toBe(input)
    })

    it('handles Hebrew text before bare bracket math', () => {
      const input = 'חשבו את [ \\frac{2}{3} + \\frac{1}{4} ]'
      const result = normalizeLatexDelimiters(input)
      expect(result).toContain('$$')
      expect(result).toContain('חשבו את')
    })
  })

  describe('undelimited LaTeX safety net', () => {
    it('wraps bare \\frac in $...$', () => {
      const input = 'the ratio is \\frac{CD}{AB}'
      const result = normalizeLatexDelimiters(input)
      expect(result).toContain('$\\frac{CD}{AB}$')
    })

    it('wraps bare \\triangle in $...$', () => {
      const input = 'in \\triangle ABC'
      const result = normalizeLatexDelimiters(input)
      expect(result).toContain('$\\triangle$')
    })

    it('wraps bare \\angle in $...$', () => {
      const input = 'where \\angle B = 90'
      const result = normalizeLatexDelimiters(input)
      expect(result).toContain('$\\angle$')
    })

    it('wraps bare \\sqrt in $...$', () => {
      const input = 'equals \\sqrt{3}'
      const result = normalizeLatexDelimiters(input)
      expect(result).toContain('$\\sqrt{3}$')
    })

    it('does NOT double-wrap already delimited math', () => {
      const input = 'already $\\frac{a}{b}$ here'
      const result = normalizeLatexDelimiters(input)
      expect(result).toBe(input)
    })

    it('does NOT double-wrap block math', () => {
      const input = '$$\\frac{a}{b}$$'
      const result = normalizeLatexDelimiters(input)
      expect(result).toBe(input)
    })

    it('wraps complex expression with subscripts', () => {
      const input = 'area \\frac{S_{\\triangle AEF}}{S_{\\triangle CDF}}'
      const result = normalizeLatexDelimiters(input)
      expect(result).toContain('$')
      expect(result).not.toMatch(/^area \\frac/) // should be wrapped
    })

    it('wraps multiple bare commands in the same text', () => {
      const input = 'given \\triangle ABC and \\angle B'
      const result = normalizeLatexDelimiters(input)
      expect(result).toContain('$\\triangle$')
      expect(result).toContain('$\\angle$')
    })

    it('leaves plain text without LaTeX commands unchanged', () => {
      const input = 'no math here, just text'
      expect(normalizeLatexDelimiters(input)).toBe(input)
    })
  })
})
