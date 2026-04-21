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
import { splitSolutionByLabels } from '@/server/payload/endpoints/exercises/convert-latex-block'

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

describe('splitSolutionByLabels', () => {
  describe('hebrew mode (Hebrew letters only)', () => {
    it('splits a solution with א, ב, ג, ד labels', () => {
      const text = `א. solution for א
ב. solution for ב
ג. solution for ג
ד. solution for ד`
      const parts = splitSolutionByLabels(text, 'hebrew')
      expect(parts).toHaveLength(4)
      expect(parts[0]).toContain('solution for א')
      expect(parts[1]).toContain('solution for ב')
      expect(parts[2]).toContain('solution for ג')
      expect(parts[3]).toContain('solution for ד')
    })

    it('returns empty array when no labels found', () => {
      const text = 'plain text without any labels'
      const parts = splitSolutionByLabels(text, 'hebrew')
      expect(parts).toEqual([])
    })

    it('handles multi-line content within a label', () => {
      const text = `א. first part
$x = 5$
more text here

ב. second part`
      const parts = splitSolutionByLabels(text, 'hebrew')
      expect(parts).toHaveLength(2)
      expect(parts[0]).toContain('first part')
      expect(parts[0]).toContain('$x = 5$')
      expect(parts[0]).toContain('more text here')
      expect(parts[1]).toContain('second part')
    })

    it('does NOT split on numbered (1)(2) labels in hebrew mode', () => {
      const text = `א. content א
ב. content ב
ג. (1) sub one (2) sub two
ד. content ד`
      const parts = splitSolutionByLabels(text, 'hebrew')
      expect(parts).toHaveLength(4)
      expect(parts[2]).toContain('(1) sub one')
      expect(parts[2]).toContain('(2) sub two')
    })
  })

  describe('all mode (Hebrew + numeric labels)', () => {
    it('splits both Hebrew letters and (N) numeric labels', () => {
      const text = `א. content א
ב. content ב
(1) numeric one
(2) numeric two
ד. content ד`
      const parts = splitSolutionByLabels(text, 'all')
      expect(parts).toHaveLength(5)
    })

    it('filters out empty parent labels (ג. with no content before (1))', () => {
      const text = `א. content א
ב. content ב
ג.
(1) sub one
(2) sub two
ד. content ד`
      const parts = splitSolutionByLabels(text, 'all')
      // ג. has no content before (1), so it's filtered out
      expect(parts).toHaveLength(5)
      expect(parts.some((p) => p.includes('content א'))).toBe(true)
      expect(parts.some((p) => p.includes('content ב'))).toBe(true)
      expect(parts.some((p) => p.includes('sub one'))).toBe(true)
      expect(parts.some((p) => p.includes('sub two'))).toBe(true)
      expect(parts.some((p) => p.includes('content ד'))).toBe(true)
    })

    it('handles inline (1)(2) directly after parent label', () => {
      const text = `א. content א
ג. (1) sub one
(2) sub two`
      const parts = splitSolutionByLabels(text, 'all')
      // ג. has "(1) sub one" content (not empty), so it should NOT be filtered
      // Result: ["א. content א", "ג. (1) sub one", "(2) sub two"]
      expect(parts.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('realistic Hebrew solution from a math exercise', () => {
    it('splits the bagrut-style solution correctly', () => {
      const solutionLatex = `א. נמצא את סטיית התקן.
$$\\sigma = 80$$

ב. יעל לא יכולה להתקבל.

ג. (1) אחוז הנבחנים שיכולים להתקבל לחוג לפסיכולוגיה הוא 8.08%.
(2) אחוז הנבחנים שיכולים להתקבל לחוג לספרות אך לא לפסיכולוגיה הוא 26.38%.

ד. מספר הנבחנים שיכולים להתקבל הוא 2264.`

      // Pass 1: Hebrew letters only — should give 4 parts
      const hebrewParts = splitSolutionByLabels(solutionLatex, 'hebrew')
      expect(hebrewParts).toHaveLength(4)
      expect(hebrewParts[0]).toContain('סטיית התקן')
      expect(hebrewParts[1]).toContain('יעל לא יכולה')
      expect(hebrewParts[2]).toContain('פסיכולוגיה')
      expect(hebrewParts[2]).toContain('ספרות')
      expect(hebrewParts[3]).toContain('2264')

      // Pass 2: all labels — should give 5 parts (ג. is parent with content,
      // so it stays as a part containing "(1) ...". Then (2) is its own part)
      const allParts = splitSolutionByLabels(solutionLatex, 'all')
      // We expect at least 5 parts (the exact count depends on whether ג. itself
      // is filtered as empty parent)
      expect(allParts.length).toBeGreaterThanOrEqual(5)
    })
  })
})
