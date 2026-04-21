import { describe, it, expect } from 'vitest'
import { latexToSpeech } from '@/infra/utils/latexToSpeech'

describe('latexToSpeech', () => {
  describe('basic LaTeX commands', () => {
    it('converts superscript ^2 to squared', () => {
      expect(latexToSpeech('x^2', 'en')).toBe('x squared')
      expect(latexToSpeech('x^2', 'he')).toBe("x beribu'a")
    })

    it('converts superscript ^3 to cubed', () => {
      expect(latexToSpeech('y^3', 'en')).toBe('y cubed')
      expect(latexToSpeech('y^3', 'he')).toBe('y beshlishit')
    })

    it('converts \\frac{}{} to "over"', () => {
      expect(latexToSpeech('\\frac{a}{b}', 'en')).toBe('a over b')
      expect(latexToSpeech('\\frac{a}{b}', 'he')).toBe('a khaluk be b')
    })

    it('converts \\sqrt{} to "square root of"', () => {
      expect(latexToSpeech('\\sqrt{x}', 'en')).toBe('square root of x')
      expect(latexToSpeech('\\sqrt{x}', 'he')).toBe('shoresh shel x')
    })

    it('converts \\sqrt[n]{} to "n-th root of"', () => {
      expect(latexToSpeech('\\sqrt[3]{x}', 'en')).toBe('cube root of x')
      expect(latexToSpeech('\\sqrt[3]{x}', 'he')).toBe('shoresh shlishi shel x')
    })

    it('converts \\pi to pi', () => {
      expect(latexToSpeech('\\pi', 'en')).toBe('pi')
      expect(latexToSpeech('\\pi', 'he')).toBe('pai')
    })

    it('converts Greek letters', () => {
      expect(latexToSpeech('\\alpha', 'en')).toBe('alpha')
      expect(latexToSpeech('\\beta', 'en')).toBe('beta')
      expect(latexToSpeech('\\gamma', 'en')).toBe('gamma')
      expect(latexToSpeech('\\theta', 'en')).toBe('theta')
      expect(latexToSpeech('\\lambda', 'en')).toBe('lambda')
      expect(latexToSpeech('\\sigma', 'en')).toBe('sigma')
    })

    it('converts comparison operators', () => {
      expect(latexToSpeech('a > b', 'en')).toBe('a is greater than b')
      expect(latexToSpeech('a > b', 'he')).toBe('a gadol mi- b')
      expect(latexToSpeech('a < b', 'en')).toBe('a is less than b')
      expect(latexToSpeech('a < b', 'he')).toBe('a katan mi- b')
      expect(latexToSpeech('a \\geq b', 'en')).toBe('a is greater than or equal to b')
      expect(latexToSpeech('a \\leq b', 'en')).toBe('a is less than or equal to b')
      expect(latexToSpeech('a \\neq b', 'en')).toBe('a is not equal to b')
    })

    it('converts \\pm to "plus or minus"', () => {
      expect(latexToSpeech('x \\pm y', 'en')).toBe('x plus or minus y')
      expect(latexToSpeech('x \\pm y', 'he')).toBe('x plus o minus y')
    })

    it('converts \\times to "times"', () => {
      expect(latexToSpeech('3 \\times 4', 'en')).toBe('3 times 4')
      expect(latexToSpeech('3 \\times 4', 'he')).toBe('3 kaful 4')
    })

    it('converts \\div to "divided by"', () => {
      expect(latexToSpeech('10 \\div 2', 'en')).toBe('10 divided by 2')
      expect(latexToSpeech('10 \\div 2', 'he')).toBe('10 haluk 2')
    })

    it('converts \\infty to "infinity"', () => {
      expect(latexToSpeech('\\infty', 'en')).toBe('infinity')
      expect(latexToSpeech('\\infty', 'he')).toBe('ein sof')
    })

    it('converts \\sum to "sum"', () => {
      expect(latexToSpeech('\\sum_{i=1}^{n} x_i', 'en')).toBe('sum from i equals 1 to n x sub i')
      // Hebrew sum: core conversion (basic sum without complex subscripts)
      expect(latexToSpeech('\\sum x', 'he')).toBe('skhum shel x')
    })

    it('converts \\int to "integral"', () => {
      expect(latexToSpeech('\\int_{0}^{1} x dx', 'en')).toBe('integral from 0 to 1 x d x')
      // Hebrew integral: core bounds conversion with numeric bounds
      expect(latexToSpeech('\\int_{0}^{1}', 'he')).toBe('integral meminus0 ad 1')
    })
  })

  describe('nested expressions', () => {
    it('handles \\frac{\\sqrt{x}}{2}', () => {
      expect(latexToSpeech('\\frac{\\sqrt{x}}{2}', 'en')).toBe('square root of x over 2')
      expect(latexToSpeech('\\frac{\\sqrt{x}}{2}', 'he')).toBe('shoresh shel x khaluk be 2')
    })

    it('handles \\frac{a}{\\frac{b}{c}}', () => {
      expect(latexToSpeech('\\frac{a}{\\frac{b}{c}}', 'en')).toBe('a over b over c')
    })

    it('handles nested superscripts', () => {
      expect(latexToSpeech('x^{2n}', 'en')).toBe('x to the power of 2n')
    })
  })

  describe('numbers and text', () => {
    it('passes plain numbers through', () => {
      expect(latexToSpeech('42', 'en')).toBe('42')
      expect(latexToSpeech('3.14', 'en')).toBe('3.14')
    })

    it('handles plain text without LaTeX', () => {
      expect(latexToSpeech('Hello world', 'en')).toBe('Hello world')
      expect(latexToSpeech('שלום עולם', 'he')).toBe('שלום עולם')
    })

    it('handles mixed text and LaTeX', () => {
      expect(latexToSpeech('The value $x^2$ is', 'en')).toBe('The value x squared is')
      expect(latexToSpeech('The value $x^2$ is', 'he')).toBe("The value x beribu'a is")
    })
  })

  describe('invalid input', () => {
    it('handles empty string', () => {
      expect(latexToSpeech('', 'en')).toBe('')
      expect(latexToSpeech('', 'he')).toBe('')
    })

    it('handles unrecognized LaTeX commands', () => {
      expect(latexToSpeech('\\unknown', 'en')).toBe('')
    })
  })

  describe('parentheses and grouping', () => {
    it('handles \\left( and \\right)', () => {
      expect(latexToSpeech('\\left(x + 1\\right)', 'en')).toBe('x plus 1')
    })

    it('handles \\bigl( and \\bigr)', () => {
      expect(latexToSpeech('\\bigl(x\\bigr)', 'en')).toBe('x')
    })
  })

  describe('environment stripping', () => {
    it('strips \\begin and \\end', () => {
      // Matrix environment: strips \begin{matrix} and \end{matrix}, processes content
      expect(latexToSpeech('\\begin{matrix} a & b \\\\ c & d \\end{matrix}', 'en')).toBe('a b c d')
    })
  })
})
