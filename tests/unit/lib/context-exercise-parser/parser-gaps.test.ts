/**
 * Tests for exercise parser gap detection.
 * Verifies the parser handles all LaTeX exercise numbering patterns
 * produced by the Gemini PDF extraction pipeline.
 */
import { describe, expect, it } from 'vitest'
import { parseContextText } from '@/lib/context-exercise-parser'

describe('context-exercise-parser: gap detection', () => {
  it('should detect exercises using \\setcounter + multiple continuation \\items', () => {
    const latex = `\\begin{enumerate}
\\setcounter{enumi}{4}
\\item Exercise 5 content here
\\item Exercise 6 content here
\\item Exercise 7 content here
\\end{enumerate}`

    const segments = parseContextText(latex)
    const exercises = segments[0].exercises

    expect(exercises.map((e) => e.number)).toEqual([5, 6, 7])
  })

  it('should detect exercises using \\item[N.] bracket notation', () => {
    const latex = `\\begin{enumerate}
\\item[34.] Exercise 34 content
\\item[35.] Exercise 35 content
\\item[36.] Exercise 36 content
\\end{enumerate}`

    const segments = parseContextText(latex)
    const exercises = segments[0].exercises

    expect(exercises.map((e) => e.number)).toEqual([34, 35, 36])
  })

  it('should detect exercises using inline \\item N. pattern', () => {
    const latex = `\\begin{enumerate}
\\item 42. Exercise 42 content
\\item 43. Exercise 43 content
\\item 44. Exercise 44 content
\\end{enumerate}`

    const segments = parseContextText(latex)
    const exercises = segments[0].exercises

    expect(exercises.map((e) => e.number)).toEqual([42, 43, 44])
  })

  it('should handle mixed patterns across multiple enumerate blocks', () => {
    const latex = `\\begin{enumerate}
\\setcounter{enumi}{0}
\\item Exercise 1 content
\\item Exercise 2 content
\\end{enumerate}

\\begin{enumerate}
\\setcounter{enumi}{4}
\\item Exercise 5 content
\\item Exercise 6 content
\\item Exercise 7 content
\\end{enumerate}

\\begin{enumerate}
\\setcounter{enumi}{7}
\\item Exercise 8 content
\\end{enumerate}`

    const segments = parseContextText(latex)
    const exercises = segments[0].exercises
    const numbers = exercises.map((e) => e.number)

    expect(numbers).toContain(1)
    expect(numbers).toContain(2)
    expect(numbers).toContain(5)
    expect(numbers).toContain(6)
    expect(numbers).toContain(7)
    expect(numbers).toContain(8)
  })

  it('should find all 70 exercises in a realistic multi-pattern document', () => {
    // Simplified version of the real extraction: exercises 1-10 using mixed patterns
    const latex = `\\begin{enumerate}
\\item First exercise content
\\item Second exercise content
\\item Third exercise content
\\end{enumerate}

\\begin{enumerate}
\\setcounter{enumi}{3}
\\item Fourth exercise
\\item Fifth exercise
\\end{enumerate}

\\begin{enumerate}
\\setcounter{enumi}{5}
\\item Sixth exercise
\\item Seventh exercise
\\item Eighth exercise
\\item Ninth exercise
\\item Tenth exercise
\\end{enumerate}`

    const segments = parseContextText(latex)
    const exercises = segments[0].exercises

    expect(exercises.length).toBe(10)
    expect(exercises.map((e) => e.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('should not stop at one continuation per setcounter', () => {
    // The old parser had `break` after finding one continuation
    const latex = `\\begin{enumerate}
\\setcounter{enumi}{29}
\\item Exercise 30 content
\\item Exercise 31 content
\\item Exercise 32 content
\\item Exercise 33 content
\\end{enumerate}`

    const segments = parseContextText(latex)
    const exercises = segments[0].exercises

    expect(exercises.map((e) => e.number)).toEqual([30, 31, 32, 33])
  })
})
