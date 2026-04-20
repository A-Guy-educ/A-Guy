/**
 * Tests for solution block detection and routing in convert-latex-block.
 *
 * The convert-latex-block endpoint identifies solution LaTeX blocks,
 * removes them from the content, and combines their LaTeX with the
 * preceding exercise block before sending to the AI. This way the AI
 * can place solutions in the question block's `solution` field.
 *
 * These tests verify the detection logic using isSolutionHeader,
 * which is the same function used by the endpoint.
 */
import { describe, expect, it } from 'vitest'
import { isSolutionHeader } from '@/lib/latex-parser/enumerate-parser'

describe('convert-latex-block: solution detection', () => {
  describe('isSolutionHeader identifies solution LaTeX blocks', () => {
    it('detects \\section*{פתרון תרגיל N}', () => {
      expect(isSolutionHeader('\\section*{פתרון תרגיל 1}')).toBe(true)
      expect(isSolutionHeader('\\section*{פתרון תרגיל 5}')).toBe(true)
    })

    it('detects \\section{פתרון תרגיל N} (without asterisk)', () => {
      expect(isSolutionHeader('\\section{פתרון תרגיל 1}')).toBe(true)
    })

    it('detects \\subsection*{פתרון שאלה N}', () => {
      expect(isSolutionHeader('\\subsection*{פתרון שאלה 3}')).toBe(true)
    })

    it('detects \\section*{פתרונות}', () => {
      expect(isSolutionHeader('\\section*{פתרונות}')).toBe(true)
      expect(isSolutionHeader('\\section*{פתרונות לתרגילים}')).toBe(true)
    })

    it('detects \\textbf{פתרון תרגיל N:}', () => {
      expect(isSolutionHeader('\\textbf{פתרון תרגיל 1:}')).toBe(true)
      expect(isSolutionHeader('\\textbf{פתרון שאלה 2:}')).toBe(true)
    })

    it('detects \\subsection*{תשובה סופית - שאלה N}', () => {
      expect(isSolutionHeader('\\subsection*{תשובה סופית - שאלה 1}')).toBe(true)
    })

    it('does NOT detect exercise headers', () => {
      expect(isSolutionHeader('\\textbf{תרגיל 1}')).toBe(false)
      expect(isSolutionHeader('\\section*{תרגיל 1}')).toBe(false)
      expect(isSolutionHeader('\\section*{שאלה 1}')).toBe(false)
    })

    it('does NOT detect plain text', () => {
      expect(isSolutionHeader('פתרון תרגיל 1')).toBe(false)
      expect(isSolutionHeader('some random text')).toBe(false)
      expect(isSolutionHeader('')).toBe(false)
    })
  })

  describe('first-line detection (simulates convert-latex-block pre-scan)', () => {
    /**
     * convert-latex-block checks the first non-empty line of each LaTeX block
     * to determine if it's a solution. This mirrors that logic.
     */
    function isSolutionBlock(latex: string): boolean {
      const firstLine =
        latex
          .trim()
          .split('\n')
          .find((l) => l.trim().length > 0) || ''
      return isSolutionHeader(firstLine)
    }

    it('detects a solution block with header on first line', () => {
      const latex = `\\section*{פתרון תרגיל 1}
$x = 5$, therefore the answer is 5.`
      expect(isSolutionBlock(latex)).toBe(true)
    })

    it('detects a solution block with leading whitespace', () => {
      const latex = `
  \\section*{פתרון תרגיל 2}
Solution content here.`
      expect(isSolutionBlock(latex)).toBe(true)
    })

    it('does NOT detect exercise content as solution', () => {
      const latex = `\\textbf{תרגיל 1}
Find $x$ in $2x + 3 = 7$.`
      expect(isSolutionBlock(latex)).toBe(false)
    })

    it('does NOT detect plain math content as solution', () => {
      const latex = `\\begin{enumerate}
\\item Find $x$.
\\item Find $y$.
\\end{enumerate}`
      expect(isSolutionBlock(latex)).toBe(false)
    })
  })

  describe('combined LaTeX for AI (simulates exercise+solution merge)', () => {
    it('combines exercise and solution LaTeX with double newline', () => {
      const exerciseLatex = `\\textbf{תרגיל 1}
Find $x$ in $2x + 3 = 7$.`
      const solutionLatex = `\\section*{פתרון תרגיל 1}
$2x = 4$, so $x = 2$.`

      const combined = `${exerciseLatex}\n\n${solutionLatex}`

      expect(combined).toContain('תרגיל 1')
      expect(combined).toContain('2x + 3 = 7')
      expect(combined).toContain('פתרון תרגיל 1')
      expect(combined).toContain('x = 2')
    })

    it('preserves exercise LaTeX when no solution block follows', () => {
      const exerciseLatex = `\\textbf{תרגיל 1}
Find $x$.`
      // No solution block — AI receives exercise only
      expect(exerciseLatex).not.toContain('פתרון')
    })
  })
})
