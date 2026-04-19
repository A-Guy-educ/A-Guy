/**
 * @fileType test
 * @domain exercises
 * @pattern solution-routing|combined-latex-block
 * @ai-summary Unit tests for the combined LaTeX block format used in create-context-exercises.
 *
 * @solution-routing-contract
 * When an exercise has a solution, the combined LaTeX block format is:
 *   {exercise.latexContent}
 *   \section*{פתרון}
 *   {exercise.solution}
 * This ensures downstream AI conversion sees exercise + solution together.
 * When exercise.solution is null, only exercise content is in the block.
 */
import { describe, it, expect } from 'vitest'
import type { ParsedExercise } from '@/lib/context-exercise-parser'

/**
 * Replicates the combined LaTeX block construction logic from
 * src/app/api/lessons/create-context-exercises/route.ts.
 *
 * Solution routing contract:
 * - With solution: exercise content + "\\section*{פתרון}" + solution
 * - Without solution: exercise content only
 */
function buildCombinedLatexBlock(exercise: ParsedExercise): string[] {
  const blocks: string[] = []

  blocks.push(exercise.latexContent)

  if (exercise.solution) {
    blocks.push('\\section*{פתרון}')
    blocks.push(exercise.solution)
  }

  return blocks
}

describe('combined LaTeX block format (create-context-exercises solution routing)', () => {
  // -------------------------------------------------------------------------
  // When exercise.solution exists — combined block must contain both
  // exercise content AND solution with proper \section*{פתרון} header
  // -------------------------------------------------------------------------
  it('should include solution in combined block when exercise.solution is present', () => {
    const exercise: ParsedExercise = {
      number: 1,
      title: 'תרגיל 1',
      header: '\\textbf{תרגיל 1}',
      latexContent: '$x + 1 = 2$',
      solution: '$x = 1$',
      solutionHeader: '\\section*{פתרון תרגיל 1}',
      hasDiagram: false,
      startIndex: 0,
      endIndex: 50,
    }

    const blocks = buildCombinedLatexBlock(exercise)

    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toBe('$x + 1 = 2$')
    expect(blocks[1]).toBe('\\section*{פתרון}')
    expect(blocks[2]).toBe('$x = 1$')
  })

  // -------------------------------------------------------------------------
  // When exercise.solution is null — only exercise content in the block
  // -------------------------------------------------------------------------
  it('should NOT include solution section when exercise.solution is null', () => {
    const exercise: ParsedExercise = {
      number: 1,
      title: 'תרגיל 1',
      header: '\\textbf{תרגיל 1}',
      latexContent: '$x + 1 = 2$',
      solution: null,
      solutionHeader: null,
      hasDiagram: false,
      startIndex: 0,
      endIndex: 50,
    }

    const blocks = buildCombinedLatexBlock(exercise)

    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toBe('$x + 1 = 2$')
    expect(blocks).not.toContain('\\section*{פתרון}')
  })

  // -------------------------------------------------------------------------
  // Combined format matches what the AI import prompt expects
  // -------------------------------------------------------------------------
  it('should produce format matching AI import prompt expectations (solution after exercise)', () => {
    const exercise: ParsedExercise = {
      number: 3,
      title: 'תרגיל 3 - משוואה',
      header: '\\textbf{תרגיל 3}',
      latexContent: 'פתור את המשוואה: $2x + 4 = 10$',
      solution: '$2x = 6 \\Rightarrow x = 3$',
      solutionHeader: '\\section*{פתרון תרגיל 3}',
      hasDiagram: false,
      startIndex: 100,
      endIndex: 200,
    }

    const blocks = buildCombinedLatexBlock(exercise)
    const combined = blocks.join('\n')

    expect(combined).toContain('פתור את המשוואה')
    expect(combined).toContain('\\section*{פתרון}')
    expect(combined).toContain('$2x = 6')
  })

  // -------------------------------------------------------------------------
  // Multi-exercise scenario: each exercise produces its own combined blocks
  // -------------------------------------------------------------------------
  it('should produce separate combined blocks for each exercise', () => {
    const exercises: ParsedExercise[] = [
      {
        number: 1,
        title: 'תרגיל 1',
        header: '\\textbf{תרגיל 1}',
        latexContent: 'חשב: $1+1$',
        solution: '$2$',
        solutionHeader: '\\section*{פתרון תרגיל 1}',
        hasDiagram: false,
        startIndex: 0,
        endIndex: 30,
      },
      {
        number: 2,
        title: 'תרגיל 2',
        header: '\\textbf{תרגיל 2}',
        latexContent: 'חשב: $2+2$',
        solution: null,
        solutionHeader: null,
        hasDiagram: false,
        startIndex: 30,
        endIndex: 60,
      },
    ]

    const allBlocks = exercises.flatMap((ex) => buildCombinedLatexBlock(ex))

    // Exercise 1 has solution → 3 blocks; Exercise 2 has no solution → 1 block
    expect(allBlocks).toHaveLength(4)
    expect(allBlocks[0]).toBe('חשב: $1+1$')
    expect(allBlocks[1]).toBe('\\section*{פתרון}')
    expect(allBlocks[2]).toBe('$2$')
    expect(allBlocks[3]).toBe('חשב: $2+2$')
  })

  // -------------------------------------------------------------------------
  // Empty solution string (falsy) — should be treated as null
  // -------------------------------------------------------------------------
  it('should treat empty solution string as no solution', () => {
    const exercise: ParsedExercise = {
      number: 1,
      title: 'תרגיל 1',
      header: '\\textbf{תרגיל 1}',
      latexContent: '$x$',
      solution: '', // empty string — falsy
      solutionHeader: null,
      hasDiagram: false,
      startIndex: 0,
      endIndex: 10,
    }

    const blocks = buildCombinedLatexBlock(exercise)

    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toBe('$x$')
  })

  // -------------------------------------------------------------------------
  // Multiline solution content should be preserved intact
  // -------------------------------------------------------------------------
  it('should preserve multiline solution content in combined block', () => {
    const exercise: ParsedExercise = {
      number: 1,
      title: 'תרגיל 1',
      header: '\\textbf{תרגיל 1}',
      latexContent: 'פתור:',
      solution: 'שלב 1: isoliere x\nשלב 2: $\\Rightarrow x = 3$',
      solutionHeader: '\\section*{פתרון תרגיל 1}',
      hasDiagram: false,
      startIndex: 0,
      endIndex: 50,
    }

    const blocks = buildCombinedLatexBlock(exercise)

    expect(blocks).toHaveLength(3)
    expect(blocks[2]).toContain('שלב 1')
    expect(blocks[2]).toContain('שלב 2')
  })
})
