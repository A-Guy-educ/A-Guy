/**
 * @fileType test
 * @domain exercises
 * @pattern latex-parser|solution-routing
 * @ai-summary Unit tests for splitLatexIntoExercises utility.
 *
 * @solution-routing-contract
 * See src/lib/latex-parser/split-exercises.ts for the solution routing contract.
 */
import { describe, it, expect } from 'vitest'
import { splitLatexIntoExercises } from '@/lib/latex-parser/split-exercises'

describe('splitLatexIntoExercises', () => {
  // -------------------------------------------------------------------------
  // Case 1: Separate solutions section
  // \section*{פתרונות} followed by \section*{פתרון תרגיל N}
  // Solutions should be excluded — they stay in question block solution fields
  // -------------------------------------------------------------------------
  it('should exclude separate solutions section from exercise chunks', () => {
    const latex = `\\documentclass{article}
\\begin{document}
\\textbf{תרגיל 1} $x + 1 = 2$

\\section*{פתרונות}
\\section*{פתרון תרגיל 1}
$x = 1$
\\end{document}`

    const chunks = splitLatexIntoExercises(latex)

    // Only the exercise should be returned, not the solution section
    expect(chunks).toHaveLength(1)
    expect(chunks[0].title).toBe('תרגיל 1')
    expect(chunks[0].latex).toContain('$x + 1 = 2$')
    expect(chunks[0].latex).not.toContain('פתרון')
  })

  // -------------------------------------------------------------------------
  // Case 2: Mismatched solution numbers — unmatched solutions should not break
  // -------------------------------------------------------------------------
  it('should handle mismatched solution numbers gracefully', () => {
    const latex = `\\begin{document}
\\textbf{תרגיל 1} question 1 content

\\section*{פתרון תרגיל 99}
solution for non-existent exercise
\\end{document}`

    const chunks = splitLatexIntoExercises(latex)

    expect(chunks).toHaveLength(1)
    expect(chunks[0].title).toBe('תרגיל 1')
    // Mismatched solution should not break parsing
  })

  // -------------------------------------------------------------------------
  // Case 3: No solutions — should return exercise-only chunks
  // -------------------------------------------------------------------------
  it('should return exercise-only chunks when no solutions section exists', () => {
    const latex = `\\begin{document}
\\textbf{תרגיל 1} Solve $x^2 = 4$
\\textbf{תרגיל 2} Find $\\frac{d}{dx}x^2$
\\end{document}`

    const chunks = splitLatexIntoExercises(latex)

    expect(chunks).toHaveLength(2)
    expect(chunks[0].title).toBe('תרגיל 1')
    expect(chunks[1].title).toBe('תרגיל 2')
    expect(chunks[0].latex).toContain('Solve')
    expect(chunks[1].latex).toContain('Find')
  })

  // -------------------------------------------------------------------------
  // Case 4: Multiple exercises with solutions interspersed
  // -------------------------------------------------------------------------
  it('should split multiple exercises correctly regardless of solution placement', () => {
    const latex = `\\begin{document}
\\textbf{תרגיל 1} $1+1=2$
\\textbf{תרגיל 2} $2+2=4$

\\section*{פתרון תרגיל 1}
$x=1$
\\section*{פתרון תרגיל 2}
$x=2$
\\end{document}`

    const chunks = splitLatexIntoExercises(latex)

    expect(chunks).toHaveLength(2)
    expect(chunks[0].title).toBe('תרגיל 1')
    expect(chunks[1].title).toBe('תרגיל 2')
    // Neither chunk should contain solution content
    expect(chunks[0].latex).not.toContain('פתרון')
    expect(chunks[1].latex).not.toContain('פתרון')
  })

  // -------------------------------------------------------------------------
  // Case 5: LaTeX with no \begin{document} — whole string is treated as body
  // -------------------------------------------------------------------------
  it('should handle LaTeX without \\begin{document}', () => {
    const latex = `\\textbf{תרגיל 1} $x=1$`

    const chunks = splitLatexIntoExercises(latex)

    expect(chunks).toHaveLength(1)
    expect(chunks[0].title).toBe('תרגיל 1')
    expect(chunks[0].latex).toBe('\\textbf{תרגיל 1} $x=1$')
  })

  // -------------------------------------------------------------------------
  // Case 6: LaTeX with preamble only — no exercises
  // -------------------------------------------------------------------------
  it('should return whole body as single chunk when no exercises found', () => {
    const latex = `\\documentclass{article}
\\usepackage{amsmath}
\\begin{document}
Some preamble text with no exercises.
\\end{document}`

    const chunks = splitLatexIntoExercises(latex)

    expect(chunks).toHaveLength(1)
    expect(chunks[0].title).toBe('')
    expect(chunks[0].latex).toContain('Some preamble text')
  })

  // -------------------------------------------------------------------------
  // Case 7: Exercise title contains "פתרון" in its name (edge case)
  // -------------------------------------------------------------------------
  it('should filter out chunks whose title contains פתרון', () => {
    const latex = `\\begin{document}
\\textbf{תרגיל 1} content 1
\\textbf{תרגיל 2} content 2
\\textbf{פתרון תרגיל 3} this should be excluded
\\end{document}`

    const chunks = splitLatexIntoExercises(latex)

    expect(chunks).toHaveLength(2)
    expect(chunks.map((c) => c.title)).toEqual(['תרגיל 1', 'תרגיל 2'])
  })

  // -------------------------------------------------------------------------
  // Case 8: Single exercise (no boundaries needed)
  // -------------------------------------------------------------------------
  it('should return a single chunk when only one exercise exists', () => {
    const latex = `\\begin{document}
\\textbf{תרגיל 1} The only exercise in this document.
\\end{document}`

    const chunks = splitLatexIntoExercises(latex)

    expect(chunks).toHaveLength(1)
    expect(chunks[0].title).toBe('תרגיל 1')
  })

  // -------------------------------------------------------------------------
  // Case 9: Chunk content boundary correctness
  // -------------------------------------------------------------------------
  it('should correctly bound chunk content between exercise headers', () => {
    const latex = `\\begin{document}
\\textbf{תרגיל 1} content of exercise 1
\\textbf{תרגיל 2} content of exercise 2
\\end{document}`

    const chunks = splitLatexIntoExercises(latex)

    expect(chunks).toHaveLength(2)
    expect(chunks[0].latex).toContain('content of exercise 1')
    expect(chunks[0].latex).not.toContain('content of exercise 2')
    expect(chunks[1].latex).toContain('content of exercise 2')
    expect(chunks[1].latex).not.toContain('content of exercise 1')
  })

  // -------------------------------------------------------------------------
  // Case 10: \section*{פתרון שאלה N} variant header
  // -------------------------------------------------------------------------
  it('should skip chunks starting with \\section*{פתרון שאלה N} variant', () => {
    const latex = `\\begin{document}
\\section*{פתרון שאלה 1}
solution content
\\end{document}`

    const chunks = splitLatexIntoExercises(latex)

    // No exercises, only a solution section — whole body treated as single empty chunk
    expect(chunks).toHaveLength(1)
    expect(chunks[0].title).toBe('')
  })
})
