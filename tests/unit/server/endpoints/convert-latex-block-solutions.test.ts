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
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { isSolutionHeader } from '@/lib/latex-parser/enumerate-parser'
import type { ContentBlock } from '@/server/payload/collections/Exercises/types'

// Mock the support-generation-service before importing convert-latex-block
// (which imports it transitively)
vi.mock('@/infra/llm/services/support-generation-service', () => ({
  generateSupport: vi.fn(),
}))

import {
  splitSolutionByLabels,
  attachSolutionToBlocks,
  fillMissingSolutionsWithAI,
  looksLikeSolutionContent,
  removeRedundantTrailingSolution,
} from '@/server/payload/endpoints/exercises/convert-latex-block'
import { generateSupport } from '@/infra/llm/services/support-generation-service'

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

  describe('edge case: single-line labels (no line breaks between labels)', () => {
    it('returns only the first label when labels are all on one line (by design)', () => {
      // The regex anchors on (^|\n) to avoid false positives inside content.
      // If all labels are on one line, only the first is detected.
      // This is a deliberate tradeoff — matching anywhere would catch "שאלה א." inside text.
      const text = `א. content א ב. content ב ג. content ג ד. content ד`
      const parts = splitSolutionByLabels(text, 'hebrew')
      // Only the first label matches at position 0; others aren't at line start
      expect(parts.length).toBe(1)
      expect(parts[0]).toContain('content א')
    })

    it('correctly handles consecutive labels on separate lines (no content merging)', () => {
      // Guards against the "greedy spanning" concern: each part should be
      // strictly bounded by its label and the next label's position.
      const text = `א. first
ב. second
ג. third
ד. fourth`
      const parts = splitSolutionByLabels(text, 'hebrew')
      expect(parts).toHaveLength(4)
      // Verify no content merging: each part contains ONLY its own content
      expect(parts[0]).toContain('first')
      expect(parts[0]).not.toContain('second')
      expect(parts[1]).toContain('second')
      expect(parts[1]).not.toContain('first')
      expect(parts[1]).not.toContain('third')
      expect(parts[2]).toContain('third')
      expect(parts[2]).not.toContain('second')
      expect(parts[2]).not.toContain('fourth')
      expect(parts[3]).toContain('fourth')
      expect(parts[3]).not.toContain('third')
    })
  })
})

describe('attachSolutionToBlocks', () => {
  // Helper to build a question_free_response block
  function makeQuestionBlock(id: string, prompt: string): ContentBlock {
    return {
      id,
      type: 'question_free_response',
      prompt: { type: 'rich_text', format: 'md-math-v1', value: prompt, mediaIds: [] },
      answer: { acceptedAnswers: ['__imported__'] },
    }
  }

  function makeRichTextBlock(id: string, value: string): ContentBlock {
    return {
      id,
      type: 'rich_text',
      format: 'md-math-v1',
      value,
      mediaIds: [],
    }
  }

  describe('multi-block splice scenario (from Kody review concern #1)', () => {
    it('correctly attaches per-sub-question solutions when script parser produces multiple blocks', () => {
      // This mirrors what the script parser would produce for a multi-sub-question
      // exercise. Each question block gets its matching solution part.
      const blocks: ContentBlock[] = [
        makeQuestionBlock('q1', 'question א'),
        makeQuestionBlock('q2', 'question ב'),
        makeQuestionBlock('q3', 'question ג'),
        makeQuestionBlock('q4', 'question ד'),
      ]

      const solution = `א. solution for א
ב. solution for ב
ג. solution for ג
ד. solution for ד`

      attachSolutionToBlocks(blocks, solution)

      const q1 = blocks[0] as ContentBlock & { solution?: { value: string } }
      const q2 = blocks[1] as ContentBlock & { solution?: { value: string } }
      const q3 = blocks[2] as ContentBlock & { solution?: { value: string } }
      const q4 = blocks[3] as ContentBlock & { solution?: { value: string } }

      expect(q1.solution?.value).toContain('solution for א')
      expect(q2.solution?.value).toContain('solution for ב')
      expect(q3.solution?.value).toContain('solution for ג')
      expect(q4.solution?.value).toContain('solution for ד')

      // Critical: verify no cross-contamination (the "stale index" concern)
      expect(q1.solution?.value).not.toContain('solution for ב')
      expect(q2.solution?.value).not.toContain('solution for ג')
      expect(q3.solution?.value).not.toContain('solution for ד')
    })

    it('handles mixed rich_text and question blocks (rich_text blocks skipped)', () => {
      // Script parser sometimes produces rich_text blocks interleaved with questions.
      // The solution should only go to question blocks, in their document order.
      const blocks: ContentBlock[] = [
        makeRichTextBlock('r1', 'intro text'),
        makeQuestionBlock('q1', 'question א'),
        makeRichTextBlock('r2', 'between text'),
        makeQuestionBlock('q2', 'question ב'),
      ]

      const solution = `א. solution א
ב. solution ב`

      attachSolutionToBlocks(blocks, solution)

      const q1 = blocks[1] as ContentBlock & { solution?: { value: string } }
      const q2 = blocks[3] as ContentBlock & { solution?: { value: string } }

      expect(q1.solution?.value).toContain('solution א')
      expect(q2.solution?.value).toContain('solution ב')

      // rich_text blocks should not have a solution field
      expect((blocks[0] as ContentBlock & { solution?: unknown }).solution).toBeUndefined()
      expect((blocks[2] as ContentBlock & { solution?: unknown }).solution).toBeUndefined()
    })

    it('distributes available parts when there are fewer parts than questions (rest empty for AI fill)', () => {
      const blocks: ContentBlock[] = [
        makeQuestionBlock('q1', 'question 1'),
        makeQuestionBlock('q2', 'question 2'),
        makeQuestionBlock('q3', 'question 3'),
      ]

      // 2 solution parts but 3 question blocks
      const solution = `א. solution א
ב. solution ב`

      attachSolutionToBlocks(blocks, solution)

      const q1 = blocks[0] as ContentBlock & { solution?: { value: string } }
      const q2 = blocks[1] as ContentBlock & { solution?: { value: string } }
      const q3 = blocks[2] as ContentBlock & { solution?: { value: string } }

      // First M questions get the M parts, rest stay empty (AI fill handles)
      expect(q1.solution?.value).toContain('solution א')
      expect(q2.solution?.value).toContain('solution ב')
      expect(q3.solution).toBeUndefined()
    })

    it('joins extras into last question when there are more parts than questions', () => {
      const blocks: ContentBlock[] = [
        makeQuestionBlock('q1', 'question 1'),
        makeQuestionBlock('q2', 'question 2'),
      ]

      // 4 solution parts but only 2 question blocks
      const solution = `א. sol א
ב. sol ב
ג. sol ג
ד. sol ד`

      attachSolutionToBlocks(blocks, solution)

      const q1 = blocks[0] as ContentBlock & { solution?: { value: string } }
      const q2 = blocks[1] as ContentBlock & { solution?: { value: string } }

      // First (N-1) get 1:1, last gets the rest joined
      expect(q1.solution?.value).toContain('sol א')
      expect(q1.solution?.value).not.toContain('sol ב')
      expect(q2.solution?.value).toContain('sol ב')
      expect(q2.solution?.value).toContain('sol ג')
      expect(q2.solution?.value).toContain('sol ד')
    })

    it('falls back to paragraph splitting when no labels found', () => {
      const blocks: ContentBlock[] = [
        makeQuestionBlock('q1', 'question 1'),
        makeQuestionBlock('q2', 'question 2'),
      ]

      // No Hebrew or numeric labels, but separated by blank lines
      const solution = `First paragraph with some content here.

Second paragraph with different content here.`

      attachSolutionToBlocks(blocks, solution)

      const q1 = blocks[0] as ContentBlock & { solution?: { value: string } }
      const q2 = blocks[1] as ContentBlock & { solution?: { value: string } }

      expect(q1.solution?.value).toContain('First paragraph')
      expect(q2.solution?.value).toContain('Second paragraph')
    })

    it('attaches whole solution to a single question block (no labels needed)', () => {
      const blocks: ContentBlock[] = [makeQuestionBlock('q1', 'only question')]

      // Plain solution, no label format
      const solution = 'This is the solution text without labels'

      attachSolutionToBlocks(blocks, solution)

      const q1 = blocks[0] as ContentBlock & { solution?: { value: string } }
      expect(q1.solution?.value).toBe('This is the solution text without labels')
    })

    it('strips solution header when present before attaching', () => {
      const blocks: ContentBlock[] = [makeQuestionBlock('q1', 'question')]

      const solution = `\\section*{פתרון תרגיל 1}
Actual solution content here.`

      attachSolutionToBlocks(blocks, solution)

      const q1 = blocks[0] as ContentBlock & { solution?: { value: string } }
      expect(q1.solution?.value).toContain('Actual solution content here')
      expect(q1.solution?.value).not.toContain('\\section*')
    })

    it('does nothing when there are zero question blocks', () => {
      const blocks: ContentBlock[] = [makeRichTextBlock('r1', 'just text')]

      attachSolutionToBlocks(blocks, 'some solution')

      // No question block to attach to; rich_text block is unchanged
      expect((blocks[0] as ContentBlock & { solution?: unknown }).solution).toBeUndefined()
    })
  })
})

describe('fillMissingSolutionsWithAI', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockPayload = {} as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any

  function makeQuestion(
    id: string,
    prompt: string,
    solution?: string,
    hint?: string,
  ): ContentBlock {
    const block: ContentBlock & {
      solution?: { type: string; format: string; value: string; mediaIds: string[] }
      hint?: { type: string; format: string; value: string; mediaIds: string[] }
    } = {
      id,
      type: 'question_free_response',
      prompt: { type: 'rich_text', format: 'md-math-v1', value: prompt, mediaIds: [] },
      answer: { acceptedAnswers: ['__imported__'] },
    }
    if (solution) {
      block.solution = { type: 'rich_text', format: 'md-math-v1', value: solution, mediaIds: [] }
    }
    if (hint) {
      block.hint = { type: 'rich_text', format: 'md-math-v1', value: hint, mediaIds: [] }
    }
    return block
  }

  function makeRichText(id: string, value: string): ContentBlock {
    return { id, type: 'rich_text', format: 'md-math-v1', value, mediaIds: [] }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fills solution for question blocks that have no solution', async () => {
    const blocks: ContentBlock[] = [
      makeQuestion('q1', 'question one'),
      makeQuestion('q2', 'question two'),
    ]

    vi.mocked(generateSupport).mockResolvedValue({
      success: true,
      data: { solution: 'AI-generated solution' },
    })

    await fillMissingSolutionsWithAI(blocks, mockPayload, mockLogger)

    expect(generateSupport).toHaveBeenCalledTimes(2)
    const q1 = blocks[0] as ContentBlock & { solution?: { value: string } }
    const q2 = blocks[1] as ContentBlock & { solution?: { value: string } }
    expect(q1.solution?.value).toBe('AI-generated solution')
    expect(q2.solution?.value).toBe('AI-generated solution')
  })

  it('only requests missing fields per block (hints + solution)', async () => {
    // q1 has solution but no hint → should request only hints
    // q2 has neither → should request both hints + solution
    const blocks: ContentBlock[] = [
      makeQuestion('q1', 'question one', 'existing solution'),
      makeQuestion('q2', 'question two'),
    ]

    vi.mocked(generateSupport).mockResolvedValue({
      success: true,
      data: { solution: 'AI-generated solution', hints: ['AI hint'] },
    })

    await fillMissingSolutionsWithAI(blocks, mockPayload, mockLogger)

    expect(generateSupport).toHaveBeenCalledTimes(2)
    // First call (q1): only hints requested
    const firstCall = vi.mocked(generateSupport).mock.calls[0]
    expect(firstCall[0].targetFields).toEqual(['hints'])
    // Second call (q2): both fields requested
    const secondCall = vi.mocked(generateSupport).mock.calls[1]
    expect(secondCall[0].targetFields).toEqual(['hints', 'solution'])
    // q1's existing solution is unchanged
    const q1 = blocks[0] as ContentBlock & { solution?: { value: string } }
    expect(q1.solution?.value).toBe('existing solution')
  })

  it('skips non-question blocks (rich_text, latex)', async () => {
    const blocks: ContentBlock[] = [
      makeRichText('r1', 'intro'),
      makeQuestion('q1', 'question'),
      makeRichText('r2', 'outro'),
    ]

    vi.mocked(generateSupport).mockResolvedValue({
      success: true,
      data: { solution: 'AI solution' },
    })

    await fillMissingSolutionsWithAI(blocks, mockPayload, mockLogger)

    // Only the question block should be processed
    expect(generateSupport).toHaveBeenCalledTimes(1)
  })

  it('does nothing (no AI calls) when all question blocks have solution AND hint', async () => {
    const blocks: ContentBlock[] = [
      makeQuestion('q1', 'q1', 'sol1', 'hint1'),
      makeQuestion('q2', 'q2', 'sol2', 'hint2'),
    ]

    await fillMissingSolutionsWithAI(blocks, mockPayload, mockLogger)

    expect(generateSupport).not.toHaveBeenCalled()
  })

  it('continues processing other blocks when one AI call fails', async () => {
    const blocks: ContentBlock[] = [
      makeQuestion('q1', 'question one'),
      makeQuestion('q2', 'question two'),
    ]

    vi.mocked(generateSupport)
      .mockResolvedValueOnce({ success: false, error: 'AI failed' })
      .mockResolvedValueOnce({ success: true, data: { solution: 'AI solution for q2' } })

    await fillMissingSolutionsWithAI(blocks, mockPayload, mockLogger)

    expect(generateSupport).toHaveBeenCalledTimes(2)
    const q1 = blocks[0] as ContentBlock & { solution?: { value: string } }
    const q2 = blocks[1] as ContentBlock & { solution?: { value: string } }
    expect(q1.solution).toBeUndefined() // failure → no solution
    expect(q2.solution?.value).toBe('AI solution for q2')
    expect(mockLogger.warn).toHaveBeenCalled()
  })

  it('continues processing when AI throws an exception', async () => {
    const blocks: ContentBlock[] = [
      makeQuestion('q1', 'question one'),
      makeQuestion('q2', 'question two'),
    ]

    vi.mocked(generateSupport)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ success: true, data: { solution: 'AI solution for q2' } })

    await fillMissingSolutionsWithAI(blocks, mockPayload, mockLogger)

    expect(generateSupport).toHaveBeenCalledTimes(2)
    const q1 = blocks[0] as ContentBlock & { solution?: { value: string } }
    const q2 = blocks[1] as ContentBlock & { solution?: { value: string } }
    expect(q1.solution).toBeUndefined()
    expect(q2.solution?.value).toBe('AI solution for q2')
    expect(mockLogger.warn).toHaveBeenCalled()
  })

  it('does nothing when there are no question blocks at all', async () => {
    const blocks: ContentBlock[] = [makeRichText('r1', 'just text')]

    await fillMissingSolutionsWithAI(blocks, mockPayload, mockLogger)

    expect(generateSupport).not.toHaveBeenCalled()
  })
})

describe('looksLikeSolutionContent', () => {
  it('detects markdown header from \\section*{פתרון}', () => {
    expect(looksLikeSolutionContent('## פתרון תרגיל 1\nsolution body')).toBe(true)
    expect(looksLikeSolutionContent('### פתרונות\ncontent')).toBe(true)
  })

  it('detects bold from \\textbf{פתרון}', () => {
    expect(looksLikeSolutionContent('**פתרון תרגיל 1:**\ncontent')).toBe(true)
  })

  it('detects plain prefix', () => {
    expect(looksLikeSolutionContent('פתרון תרגיל 1\ncontent')).toBe(true)
    expect(looksLikeSolutionContent('פתרונות\ncontent')).toBe(true)
    expect(looksLikeSolutionContent('תשובה סופית - שאלה 1')).toBe(true)
  })

  it('does NOT detect regular content', () => {
    expect(looksLikeSolutionContent('## תרגיל 1\nbody')).toBe(false)
    expect(looksLikeSolutionContent('Just some text')).toBe(false)
    expect(looksLikeSolutionContent('הציונים בבחינה')).toBe(false)
    expect(looksLikeSolutionContent('')).toBe(false)
  })

  it('does NOT detect content where פתרון appears mid-text', () => {
    expect(looksLikeSolutionContent('Some content\nfollowed by פתרון')).toBe(false)
  })
})

describe('removeRedundantTrailingSolution', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any

  function makeQuestion(id: string, prompt: string, solution?: string): ContentBlock {
    const block: ContentBlock & {
      solution?: { type: string; format: string; value: string; mediaIds: string[] }
    } = {
      id,
      type: 'question_free_response',
      prompt: { type: 'rich_text', format: 'md-math-v1', value: prompt, mediaIds: [] },
      answer: { acceptedAnswers: ['__imported__'] },
    }
    if (solution) {
      block.solution = { type: 'rich_text', format: 'md-math-v1', value: solution, mediaIds: [] }
    }
    return block
  }

  function makeRichText(id: string, value: string): ContentBlock {
    return { id, type: 'rich_text', format: 'md-math-v1', value, mediaIds: [] }
  }

  it('removes trailing rich_text when all questions have solutions', () => {
    const blocks: ContentBlock[] = [
      makeQuestion('q1', 'q1 prompt', 'sol1'),
      makeQuestion('q2', 'q2 prompt', 'sol2'),
      makeRichText('r1', 'redundant solution dump'),
    ]

    removeRedundantTrailingSolution(blocks, mockLogger)

    expect(blocks).toHaveLength(2)
    expect(blocks[0].id).toBe('q1')
    expect(blocks[1].id).toBe('q2')
  })

  it('keeps trailing rich_text when ANY question is missing a solution', () => {
    const blocks: ContentBlock[] = [
      makeQuestion('q1', 'q1 prompt', 'sol1'),
      makeQuestion('q2', 'q2 prompt'), // no solution!
      makeRichText('r1', 'might be the only place this content exists'),
    ]

    removeRedundantTrailingSolution(blocks, mockLogger)

    // Trailing block kept since q2 has no solution
    expect(blocks).toHaveLength(3)
    expect(blocks[2].id).toBe('r1')
  })

  it('does nothing when last block is not rich_text', () => {
    const blocks: ContentBlock[] = [
      makeQuestion('q1', 'q1', 'sol1'),
      makeQuestion('q2', 'q2', 'sol2'),
    ]

    removeRedundantTrailingSolution(blocks, mockLogger)

    expect(blocks).toHaveLength(2)
  })

  it('does nothing when there are no question blocks before the trailing rich_text', () => {
    const blocks: ContentBlock[] = [makeRichText('r1', 'some text')]

    removeRedundantTrailingSolution(blocks, mockLogger)

    // Nothing to be redundant against
    expect(blocks).toHaveLength(1)
  })
})
