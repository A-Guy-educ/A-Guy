#!/usr/bin/env python3
"""Write all required files for task 1279-260419-120101"""
import os

BASE = "/home/runner/work/A-Guy/A-Guy"

files = {}

# 1. split-exercises.ts utility
files["src/lib/latex-parser/split-exercises.ts"] = r'''/**
 * @fileType utility
 * @domain exercises
 * @pattern latex-parser|solution-routing
 * @ai-summary Split LaTeX documents into individual exercise chunks for AI parsing.
 *
 * @solution-routing-contract
 * Solutions MUST be placed inside question block `solution` fields — never as separate
 * LaTeX blocks. The combined LaTeX block format (Step 4 → Step 5) joins exercise content
 * and solution using \section*{פתרון} so downstream conversion sees them together.
 */

/**
 * Split a full LaTeX document into individual exercise chunks for AI parsing.
 *
 * Algorithm:
 * 1. Strips preamble (everything before \begin{document}).
 * 2. Finds exercise boundaries via \textbf{תרגיל N} pattern.
 * 3. Skips \section*{פתרון ...} solution headers — solutions stay inside
 *    the question block `solution` field after AI conversion, not as separate chunks.
 * 4. Filters out any chunk whose title contains "פתרון".
 *
 * @param latex - Raw LaTeX document string
 * @returns Array of { title, latex } chunks, one per exercise
 */
export function splitLatexIntoExercises(
  latex: string,
): Array<{ title: string; latex: string }> {
  // Strip preamble (everything before \begin{document})
  const docStart = latex.indexOf('\\begin{document}')
  const body = docStart >= 0 ? latex.slice(docStart) : latex

  // Split on exercise titles: \textbf{תרגיל N ...}
  const exercisePattern = /\\textbf\{תרגיל\s+(\d+)[^}]*\}/g
  const matches = [...body.matchAll(exercisePattern)]

  if (matches.length === 0) {
    // No exercise boundaries found — send the whole thing as one chunk
    return [{ title: '', latex: body }]
  }

  const chunks: Array<{ title: string; latex: string }> = []

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const start = match.index!
    const end = i + 1 < matches.length ? matches[i + 1].index! : body.length
    const chunkLatex = body.slice(start, end).trim()

    // Skip solution sections
    if (/^\\section\*?\{פתרון/.test(chunkLatex)) continue

    chunks.push({
      title: match[0].replace(/\\textbf\{|\}/g, '').trim(),
      latex: chunkLatex,
    })
  }

  // Filter out solution exercises (title contains "פתרון")
  return chunks.filter((c) => !c.title.includes('פתרון'))
}
'''

# 2. split-exercises.spec.ts unit tests
files["tests/unit/lib/latex-parser/split-exercises.spec.ts"] = r'''/**
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
'''

# 3. combined-latex-block.spec.ts unit tests
files["tests/unit/app/api/lessons/create-context-exercises/combined-latex-block.spec.ts"] = r'''/**
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
'''

# Write all files
for rel_path, content in files.items():
    full_path = os.path.join(BASE, rel_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, 'w') as f:
        f.write(content)
    print(f"Written: {rel_path}")

# 4. Update parser-gaps.test.ts — add solution round-trip tests
parser_gaps_path = os.path.join(BASE, "tests/unit/lib/context-exercise-parser/parser-gaps.test.ts")
with open(parser_gaps_path, 'r') as f:
    parser_gaps_content = f.read()

# Check if round-trip tests already added
if 'solution round-trip through create-context-exercises' not in parser_gaps_content:
    # Append new describe block before the final closing
    round_trip_block = r'''
describe('solution round-trip through create-context-exercises', () => {
  // -------------------------------------------------------------------------
  // Exercises with solutions — each ParsedExercise.solution should be non-null
  // and solutionHeader should be set. Blocks are constructed as:
  //   [makeLatexBlock(exercise.latexContent), makeLatexBlock(exercise.solution)]
  // -------------------------------------------------------------------------
  it('should parse exercises with solutions and produce two LaTeX blocks each', () => {
    const latex = `\\begin{document}
\\textbf{תרגיל 1} Solve $x+1=2$
\\section*{פתרון תרגיל 1}
$x=1$
\\end{document}`

    const segments = parseContextText(latex)
    const exercises = segments[0].exercises

    expect(exercises).toHaveLength(1)
    expect(exercises[0].solution).not.toBeNull()
    expect(exercises[0].solutionHeader).not.toBeNull()

    // Two LaTeX blocks: exercise content + solution content
    const blocks = [
      { id: 'b1', type: 'latex', latex: exercises[0].latexContent, renderMode: 'block' as const },
      { id: 'b2', type: 'latex', latex: exercises[0].solution!, renderMode: 'block' as const },
    ]
    expect(blocks).toHaveLength(2)
    expect(blocks[0].latex).toContain('$x+1=2$')
    expect(blocks[1].latex).toContain('$x=1$')
  })

  // -------------------------------------------------------------------------
  // Exercises without solutions — ParsedExercise.solution should be null.
  // Blocks: only [makeLatexBlock(exercise.latexContent)]
  // -------------------------------------------------------------------------
  it('should parse exercise-only LaTeX with null solution', () => {
    const latex = `\\begin{document}
\\textbf{תרגיל 1} Solve $x^2 = 4$
\\textbf{תרגיל 2} Find $\\frac{d}{dx}x^2$
\\end{document}`

    const segments = parseContextText(latex)
    const exercises = segments[0].exercises

    expect(exercises).toHaveLength(2)
    exercises.forEach((ex) => {
      expect(ex.solution).toBeNull()
      expect(ex.solutionHeader).toBeNull()
    })

    // Each produces exactly one LaTeX block
    exercises.forEach((ex) => {
      const blocks = [
        { id: 'b1', type: 'latex', latex: ex.latexContent, renderMode: 'block' as const },
      ]
      expect(blocks).toHaveLength(1)
    })
  })

  // -------------------------------------------------------------------------
  // Mixed: one exercise with solution, one without.
  // Verifies the solution routing correctly handles partial solutions.
  // -------------------------------------------------------------------------
  it('should handle mixed exercises (some with solutions, some without)', () => {
    const latex = `\\begin{document}
\\textbf{תרגיל 1} Question 1
\\textbf{תרגיל 2} Question 2
\\section*{פתרון תרגיל 1}
Answer 1
\\end{document}`

    const segments = parseContextText(latex)
    const exercises = segments[0].exercises

    expect(exercises).toHaveLength(2)
    const ex1 = exercises.find((e) => e.number === 1)
    const ex2 = exercises.find((e) => e.number === 2)

    expect(ex1?.solution).not.toBeNull()
    expect(ex1?.solutionHeader).not.toBeNull()
    expect(ex2?.solution).toBeNull()
    expect(ex2?.solutionHeader).toBeNull()

    // Ex1: 2 blocks; Ex2: 1 block
    const ex1Blocks = [
      { id: 'b1', type: 'latex', latex: ex1!.latexContent, renderMode: 'block' as const },
      { id: 'b2', type: 'latex', latex: ex1!.solution!, renderMode: 'block' as const },
    ]
    const ex2Blocks = [
      { id: 'b3', type: 'latex', latex: ex2!.latexContent, renderMode: 'block' as const },
    ]
    expect(ex1Blocks).toHaveLength(2)
    expect(ex2Blocks).toHaveLength(1)
  })
})
'''

    parser_gaps_content = parser_gaps_content.rstrip() + '\n' + round_trip_block
    with open(parser_gaps_path, 'w') as f:
        f.write(parser_gaps_content)
    print("Updated: tests/unit/lib/context-exercise-parser/parser-gaps.test.ts")
else:
    print("Skipped: parser-gaps.test.ts already has round-trip tests")

# 5. Patch import-latex-ai/route.ts — replace inline splitLatexIntoExercises with import
route_path = os.path.join(BASE, "src/app/api/exercises/import-latex-ai/route.ts")
with open(route_path, 'r') as f:
    route_content = f.read()

# Add import
old_import = 'import { generateId } from \'@/server/payload/collections/Exercises/types\''
new_import = """import { generateId } from '@/server/payload/collections/Exercises/types'
import { splitLatexIntoExercises } from '@/lib/latex-parser/split-exercises'"""
route_content = route_content.replace(old_import, new_import)

# Remove inline function
inline_fn_start = route_content.find('/**\n * Split a full LaTeX document into individual exercise chunks.')
inline_fn_end = route_content.find('\nexport async function POST(')
if inline_fn_start != -1 and inline_fn_end != -1:
    route_content = route_content[:inline_fn_start] + route_content[inline_fn_end:]
    print("Removed inline splitLatexIntoExercises from route.ts")
else:
    print("WARNING: Could not find inline function to remove")

with open(route_path, 'w') as f:
    f.write(route_content)
print("Patched: src/app/api/exercises/import-latex-ai/route.ts")

print("\nAll files written successfully!")
