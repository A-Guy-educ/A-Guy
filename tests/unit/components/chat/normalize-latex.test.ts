import { normalizeLatexDelimiters } from '@/ui/web/chat/ChatMessageContent/normalize-latex'
import { describe, expect, it } from 'vitest'

describe('normalizeLatexDelimiters', () => {
  describe('block math \\[...\\]', () => {
    it('leaves lone \\[ unchanged (streaming safety)', () => {
      expect(normalizeLatexDelimiters('\\[')).toBe('\\[')
    })

    it('leaves lone \\] unchanged (streaming safety)', () => {
      expect(normalizeLatexDelimiters('\\]')).toBe('\\]')
    })

    it('converts full block math expression', () => {
      const input = '\\[ f(x) = \\frac{a}{b} \\]'
      const expected = '\n\n$$\nf(x) = \\frac{a}{b}\n$$\n\n'
      expect(normalizeLatexDelimiters(input)).toBe(expected)
    })

    it('converts Gaussian formula', () => {
      const input =
        '\\[ f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2} \\]'
      const expected =
        '\n\n$$\nf(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2}\n$$\n\n'
      expect(normalizeLatexDelimiters(input)).toBe(expected)
    })
  })

  describe('inline math \\(...\\) preserved as inline', () => {
    it('leaves lone \\( unchanged (streaming safety)', () => {
      expect(normalizeLatexDelimiters('\\(')).toBe('\\(')
    })

    it('leaves lone \\) unchanged (streaming safety)', () => {
      expect(normalizeLatexDelimiters('\\)')).toBe('\\)')
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
      const expected = 'Inline $a+b$ and block:\n\n\n$$\nx^2\n$$\n\n'
      expect(normalizeLatexDelimiters(input)).toBe(expected)
    })

    it('preserves Hebrew text', () => {
      const input = 'הנוסחה היא \\[ f(x) = x^2 \\]'
      const expected = 'הנוסחה היא \n\n$$\nf(x) = x^2\n$$\n\n'
      expect(normalizeLatexDelimiters(input)).toBe(expected)
    })
  })

  describe('already normalized content', () => {
    it('leaves $...$ unchanged', () => {
      const input = '$x^2$'
      expect(normalizeLatexDelimiters(input)).toBe(input)
    })

    it('ensures $$...$$ has newlines for remark-math', () => {
      const input = '$$\\frac{a}{b}$$'
      const result = normalizeLatexDelimiters(input)
      expect(result).toContain('$$')
      expect(result).toContain('\\frac{a}{b}')
    })

    it('leaves plain text unchanged', () => {
      const input = 'Hello world'
      expect(normalizeLatexDelimiters(input)).toBe(input)
    })
  })

  describe('JSON-escaped backslashes', () => {
    it('leaves lone JSON-escaped \\[ unchanged (streaming safety)', () => {
      expect(normalizeLatexDelimiters('\\\\[')).toBe('\\\\[')
    })

    it('leaves lone JSON-escaped \\] unchanged (streaming safety)', () => {
      expect(normalizeLatexDelimiters('\\\\]')).toBe('\\\\]')
    })

    it('converts full JSON-escaped block math expression', () => {
      const input = '\\\\[ f(x) = x^2 \\\\]'
      const expected = '\n\n$$\nf(x) = x^2\n$$\n\n'
      expect(normalizeLatexDelimiters(input)).toBe(expected)
    })

    it('leaves lone JSON-escaped \\( unchanged (streaming safety)', () => {
      expect(normalizeLatexDelimiters('\\\\(')).toBe('\\\\(')
    })

    it('leaves lone JSON-escaped \\) unchanged (streaming safety)', () => {
      expect(normalizeLatexDelimiters('\\\\)')).toBe('\\\\)')
    })

    it('converts full JSON-escaped inline math expression to inline $', () => {
      const input = 'The value is \\\\(x^2\\\\) here'
      const expected = 'The value is $x^2$ here'
      expect(normalizeLatexDelimiters(input)).toBe(expected)
    })
  })

  describe('triple-escaped backslashes (LLM over-escaping)', () => {
    it('leaves lone triple-escaped \\\\\\[ unchanged (streaming safety)', () => {
      expect(normalizeLatexDelimiters('\\\\\\[')).toBe('\\\\\\[')
    })

    it('leaves lone triple-escaped \\\\\\] unchanged (streaming safety)', () => {
      expect(normalizeLatexDelimiters('\\\\\\]')).toBe('\\\\\\]')
    })

    it('leaves lone triple-escaped inline delimiters unchanged (streaming safety)', () => {
      expect(normalizeLatexDelimiters('\\\\\\(')).toBe('\\\\\\(')
      expect(normalizeLatexDelimiters('\\\\\\)')).toBe('\\\\\\)')
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
        '\n\n$$\nf(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2}\n$$\n\n'
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
      const expected = '\n\n$$\na\n$$\n\n and \n\n$$\nb\n$$\n\n'
      expect(normalizeLatexDelimiters(input)).toBe(expected)
    })
  })

  describe('deep indentation collapsing (prevents <pre><code> blocks)', () => {
    it('collapses 8-space indentation to prevent code blocks', () => {
      const input = '1.  **Title:**\n        text with \\(f\\) here'
      const result = normalizeLatexDelimiters(input)
      // 8 spaces should be halved to 4, then to 2
      expect(result).not.toMatch(/^ {4,}/m)
      expect(result).toContain('$f$')
    })

    it('collapses 4-space indentation', () => {
      const input = '    *   text with \\(x\\) math'
      const result = normalizeLatexDelimiters(input)
      expect(result).not.toMatch(/^ {4,}/m)
      expect(result).toContain('$x$')
    })

    it('preserves 2-space indentation', () => {
      const input = '  - nested item'
      expect(normalizeLatexDelimiters(input)).toBe('  - nested item')
    })

    it('handles nested list with math that would become code block', () => {
      const input = '1.  **Title:**\n    *   כאשר \\(\\mu\\) הוא הממוצע\n        \\[f(x) = x^2\\]'
      const result = normalizeLatexDelimiters(input)
      expect(result).toContain('$\\mu$')
      expect(result).toContain('$$')
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

    it('preserves \\left[...\\right] inside display math', () => {
      const input = '\\[ \\int f(\\tau) \\left[ \\int g(t-\\tau) dt \\right] d\\tau \\]'
      const result = normalizeLatexDelimiters(input)
      expect(result).toContain('\\left[')
      expect(result).toContain('\\right]')
      expect(result).toContain('$$')
    })

    it('preserves \\bigl[...\\bigr] inside display math', () => {
      const input = '\\[ \\bigl[ \\frac{a}{b} \\bigr] \\]'
      const result = normalizeLatexDelimiters(input)
      expect(result).toContain('\\bigl[')
      expect(result).toContain('\\bigr]')
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
      // Should contain the math content with $$ delimiters, not wrapped again in $
      expect(result).toContain('\\frac{a}{b}')
      expect(result).not.toMatch(/\$\$\$/) // no triple $
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

  describe('inline $$ normalization (block math must be on own line)', () => {
    it('adds newlines around inline $$ delimiters', () => {
      const input = 'text $$\\frac{a}{b}$$ more'
      const result = normalizeLatexDelimiters(input)
      expect(result).toContain('text')
      expect(result).toContain('\n$$\n')
      expect(result).toContain('\\frac{a}{b}')
      expect(result).toContain('more')
    })

    it('preserves $$ already on their own lines', () => {
      const input = 'text\n$$\n\\frac{a}{b}\n$$\nmore'
      const result = normalizeLatexDelimiters(input)
      expect(result).toContain('\\frac{a}{b}')
      expect(result).toContain('$$')
    })

    it('handles Hebrew text with inline $$ from PDF context', () => {
      const input = 'הגרף שלה חותך את ציר $$\\frac{8-4x}{(x-1)^2}$$ בנקודה'
      const result = normalizeLatexDelimiters(input)
      expect(result).toContain('\n$$\n')
      expect(result).toContain('הגרף שלה חותך את ציר')
      expect(result).toContain('בנקודה')
    })

    it('handles multiple inline $$ in one line', () => {
      const input = 'given $$a + b$$ and $$c + d$$ values'
      const result = normalizeLatexDelimiters(input)
      expect(result).toContain('\n$$\n')
      expect(result).toContain('a + b')
      expect(result).toContain('c + d')
    })
  })

  describe('inline $ internal spacing (LLM outputs $ x $ with spaces)', () => {
    it('trims spaces inside $ delimiters: $ x $ → $x$', () => {
      const input = '$ x $'
      expect(normalizeLatexDelimiters(input)).toBe('$x$')
    })

    it('trims spaces around LaTeX commands: $ \\mu $ → $\\mu$', () => {
      const input = '$ \\mu $'
      expect(normalizeLatexDelimiters(input)).toBe('$\\mu$')
    })

    it('trims spaces in complex expression: $ \\frac{a}{b} $ → $\\frac{a}{b}$', () => {
      const input = '$ \\frac{a}{b} $'
      expect(normalizeLatexDelimiters(input)).toBe('$\\frac{a}{b}$')
    })

    it('handles multiple spaced inline math in one string', () => {
      const input = '$ X $ הוא הערך ו$ \\mu $ הוא הממוצע'
      const result = normalizeLatexDelimiters(input)
      expect(result).toContain('$X$')
      expect(result).toContain('$\\mu$')
    })

    it('does not trim tight $...$ (already correct)', () => {
      const input = '$x$ and $\\mu$'
      expect(normalizeLatexDelimiters(input)).toBe('$x$ and $\\mu$')
    })

    it('handles mixed spaced and tight inline math', () => {
      const input = '$ \\sigma $ and $x$'
      const result = normalizeLatexDelimiters(input)
      expect(result).toContain('$\\sigma$')
      expect(result).toContain('$x$')
    })
  })

  describe('inline $ spacing for remarkMath detection', () => {
    it('adds space before $ when preceded by Hebrew text', () => {
      const input = 'ההיקף$s$של'
      const result = normalizeLatexDelimiters(input)
      expect(result).toContain(' $s$ ')
    })

    it('adds space after $ when followed by Hebrew text', () => {
      const input = '$x$נתון'
      const result = normalizeLatexDelimiters(input)
      expect(result).toContain('$x$ ')
    })

    it('preserves existing spaces around $', () => {
      const input = 'text $x$ more'
      const result = normalizeLatexDelimiters(input)
      expect(result).toBe('text $x$ more')
    })

    it('does not add space before $ after punctuation', () => {
      const input = 'value,$x$ here'
      const result = normalizeLatexDelimiters(input)
      // comma is not a word char so no space needed before, but after $x$ before "here"
      expect(result).toContain('$x$')
    })

    it('does not add space after $ before punctuation', () => {
      const input = '$x$, and $y$.'
      const result = normalizeLatexDelimiters(input)
      expect(result).toBe('$x$, and $y$.')
    })

    it('handles multiple inline math with Hebrew between', () => {
      const input = "מצאו$f(x)$וגם$f'(x)$חיובית"
      const result = normalizeLatexDelimiters(input)
      expect(result).toContain(' $f(x)$ ')
      expect(result).toContain(" $f'(x)$ ")
    })
  })
})
