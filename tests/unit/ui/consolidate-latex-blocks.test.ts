import { describe, expect, it } from 'vitest'
import {
  consolidateLatexBlocks,
  type ExerciseLatexSource,
} from '@/ui/web/shared/LatexDocumentViewer/consolidate-latex-blocks'
import { latexToMarkdownWithDiagrams } from '@/ui/web/shared/LatexDocumentViewer/latex-to-markdown'

function exercise(
  id: string,
  title: string | null,
  blocks: ReadonlyArray<Record<string, unknown>>,
): ExerciseLatexSource {
  return { id, title, content: { blocks } }
}

describe('consolidateLatexBlocks', () => {
  it('returns empty result when no exercises are supplied', () => {
    const result = consolidateLatexBlocks([])
    expect(result).toEqual({ latex: '', blockCount: 0, hasContent: false })
  })

  it('returns empty result when no exercise has a latex block', () => {
    const exercises = [
      exercise('e1', 'Q1', [{ type: 'question_free_response', id: 'q1' }]),
      exercise('e2', 'Q2', [{ type: 'rich_text', id: 'r1', value: 'hello' }]),
    ]
    const result = consolidateLatexBlocks(exercises)
    expect(result.hasContent).toBe(false)
    expect(result.blockCount).toBe(0)
  })

  it('collects latex blocks across exercises preserving order', () => {
    const exercises = [
      exercise('e1', 'First', [
        { type: 'latex', id: 'l1', latex: 'x^2 + 1' },
        { type: 'question_free_response', id: 'q1' },
      ]),
      exercise('e2', 'Second', [{ type: 'latex', id: 'l2', latex: '\\int_0^1 x \\, dx' }]),
    ]
    const result = consolidateLatexBlocks(exercises)

    expect(result.blockCount).toBe(2)
    expect(result.hasContent).toBe(true)
    const firstTitleIdx = result.latex.indexOf('## First')
    const firstBlockIdx = result.latex.indexOf('x^2 + 1')
    const secondTitleIdx = result.latex.indexOf('## Second')
    const secondBlockIdx = result.latex.indexOf('\\int_0^1 x \\, dx')

    expect(firstTitleIdx).toBeGreaterThanOrEqual(0)
    expect(firstBlockIdx).toBeGreaterThan(firstTitleIdx)
    expect(secondTitleIdx).toBeGreaterThan(firstBlockIdx)
    expect(secondBlockIdx).toBeGreaterThan(secondTitleIdx)
  })

  it('skips exercises that do not contribute latex blocks', () => {
    const exercises = [
      exercise('e1', 'Has LaTeX', [{ type: 'latex', id: 'l1', latex: 'a + b' }]),
      exercise('e2', 'Only questions', [{ type: 'question_free_response', id: 'q1' }]),
    ]
    const result = consolidateLatexBlocks(exercises)

    expect(result.blockCount).toBe(1)
    expect(result.latex).toContain('## Has LaTeX')
    expect(result.latex).not.toContain('Only questions')
  })

  it('omits the heading when an exercise has no title', () => {
    const exercises = [exercise('e1', null, [{ type: 'latex', id: 'l1', latex: 'c = 42' }])]
    const result = consolidateLatexBlocks(exercises)

    expect(result.blockCount).toBe(1)
    expect(result.latex).not.toContain('## ')
    expect(result.latex).toContain('c = 42')
  })

  it('emits titles verbatim as markdown headings without LaTeX escaping', () => {
    const exercises = [
      exercise('e1', '50% off & more_stuff', [{ type: 'latex', id: 'l1', latex: 'y = x' }]),
    ]
    const result = consolidateLatexBlocks(exercises)

    // Markdown H2 emission avoids the downstream \section*{...} regex entirely,
    // so LaTeX-special characters pass through untouched.
    expect(result.latex).toContain('## 50% off & more_stuff')
  })

  it('collapses internal whitespace in titles but preserves punctuation', () => {
    const exercises = [
      exercise('e1', '  multi   line\ntitle\t\there  ', [
        { type: 'latex', id: 'l1', latex: 'z = 0' },
      ]),
    ]
    const result = consolidateLatexBlocks(exercises)

    // Whitespace normalised to single spaces so the heading stays on one line.
    expect(result.latex).toContain('## multi line title here')
  })

  it('round-trips heading cleanly through latexToMarkdownWithDiagrams', () => {
    // Regression: the previous `\section*{...}` emission had a downstream
    // regex that terminated at the first `}`, truncating headings whose
    // titles contained `}`, `\`, `^`, or `~`. Emitting markdown H2 directly
    // bypasses that regex entirely — the title flows through intact.
    const trickyTitle = 'Problem {1}: a^b \\ escape'
    const result = consolidateLatexBlocks([
      exercise('e1', trickyTitle, [{ type: 'latex', id: 'l1', latex: 'x = 1' }]),
    ])
    const { segments } = latexToMarkdownWithDiagrams(result.latex)
    const markdown = segments.join('\n')

    // Heading includes every substantive token from the source title.
    const headingLine = markdown.split('\n').find((l) => l.startsWith('## '))
    expect(headingLine).toBeDefined()
    expect(headingLine).toContain('Problem')
    expect(headingLine).toContain('{1}')
    expect(headingLine).toContain('a^b')
    expect(headingLine).toContain('escape')
    // The block body still flows through after the heading.
    expect(markdown).toContain('x = 1')
    // No \section* residue; no stray accent expansions.
    expect(markdown).not.toContain('\\section*')
    expect(markdown).not.toContain('\\textbackslash')
  })

  it('accepts content as a bare array of blocks', () => {
    const result = consolidateLatexBlocks([
      { id: 'e1', title: 'Bare', content: [{ type: 'latex', id: 'l1', latex: '1 + 1' }] },
    ])
    expect(result.blockCount).toBe(1)
    expect(result.latex).toContain('1 + 1')
  })

  it('ignores latex blocks with missing or empty latex field', () => {
    const exercises = [
      exercise('e1', 'Bad', [
        { type: 'latex', id: 'l1' },
        { type: 'latex', id: 'l2', latex: '' },
        { type: 'latex', id: 'l3', latex: 'valid' },
      ]),
    ]
    const result = consolidateLatexBlocks(exercises)
    expect(result.blockCount).toBe(1)
    expect(result.latex).toContain('valid')
  })

  it('handles malformed content (null / non-object / missing blocks) without throwing', () => {
    // content: null
    const a = consolidateLatexBlocks([{ id: 'e1', title: 't', content: null }])
    expect(a.hasContent).toBe(false)

    // content: string
    const b = consolidateLatexBlocks([{ id: 'e2', title: 't', content: 'not-a-blocks-shape' }])
    expect(b.hasContent).toBe(false)

    // content: { blocks: 'string' } — blocks isn't an array
    const c = consolidateLatexBlocks([{ id: 'e3', title: 't', content: { blocks: 'oops' } }])
    expect(c.hasContent).toBe(false)

    // content: { blocks: [ non-object ] }
    const d = consolidateLatexBlocks([
      { id: 'e4', title: 't', content: { blocks: [null, 42, undefined] } },
    ])
    expect(d.hasContent).toBe(false)
  })

  it('concatenates multiple latex blocks within a single exercise in declaration order', () => {
    const exercises = [
      exercise('e1', 'Multi', [
        { type: 'latex', id: 'l1', latex: 'FIRST_MARKER' },
        { type: 'rich_text', id: 'r1', value: 'ignored' },
        { type: 'latex', id: 'l2', latex: 'SECOND_MARKER' },
      ]),
    ]
    const result = consolidateLatexBlocks(exercises)
    expect(result.blockCount).toBe(2)
    const firstIdx = result.latex.indexOf('FIRST_MARKER')
    const secondIdx = result.latex.indexOf('SECOND_MARKER')
    expect(firstIdx).toBeGreaterThanOrEqual(0)
    expect(secondIdx).toBeGreaterThan(firstIdx)
  })

  it('preserves embedded tikzpicture content so it can be re-parsed by the viewer pipeline', () => {
    const tikz = String.raw`\begin{tikzpicture}
\begin{axis}[xmin=-2, xmax=2, ymin=-4, ymax=4]
  \addplot[domain=-1:1] {x^2};
\end{axis}
\end{tikzpicture}`
    const exercises = [exercise('e1', 'Parabola', [{ type: 'latex', id: 'l1', latex: tikz }])]
    const result = consolidateLatexBlocks(exercises)
    expect(result.latex).toContain('\\begin{tikzpicture}')
    expect(result.latex).toContain('\\begin{axis}')
    expect(result.latex).toContain('\\addplot[domain=-1:1] {x^2}')
    expect(result.latex).toContain('\\end{tikzpicture}')
  })

  it('trims whitespace around each latex block but keeps internal newlines', () => {
    const exercises = [
      exercise('e1', 't', [{ type: 'latex', id: 'l1', latex: '   \n\n  line1\nline2  \n\n ' }]),
    ]
    const result = consolidateLatexBlocks(exercises)
    // Leading/trailing whitespace trimmed; internal line break preserved.
    expect(result.latex.endsWith('line2')).toBe(true)
    expect(result.latex).toContain('line1\nline2')
    expect(result.latex.startsWith(' ')).toBe(false)
  })

  it('returns an empty string when every exercise has a malformed content field', () => {
    const result = consolidateLatexBlocks([
      { id: 'e1', title: 'a', content: undefined },
      { id: 'e2', title: 'b', content: 42 as unknown as never },
      { id: 'e3', title: 'c', content: { blocks: [] } },
    ])
    expect(result).toEqual({ latex: '', blockCount: 0, hasContent: false })
  })

  it('interleaves sections and blocks in source order across mixed exercises', () => {
    const exercises = [
      exercise('e1', 'A', [{ type: 'latex', id: 'l1', latex: 'A_BLOCK' }]),
      exercise('e2', 'B', []),
      exercise('e3', 'C', [{ type: 'latex', id: 'l2', latex: 'C_BLOCK' }]),
    ]
    const result = consolidateLatexBlocks(exercises)
    expect(result.blockCount).toBe(2)
    // Empty exercise (B) is skipped entirely; A then C preserved in order.
    const a = result.latex.indexOf('## A')
    const aBlock = result.latex.indexOf('A_BLOCK')
    const c = result.latex.indexOf('## C')
    const cBlock = result.latex.indexOf('C_BLOCK')
    expect(a).toBeGreaterThanOrEqual(0)
    expect(aBlock).toBeGreaterThan(a)
    expect(c).toBeGreaterThan(aBlock)
    expect(cBlock).toBeGreaterThan(c)
    expect(result.latex).not.toContain('## B')
  })
})
