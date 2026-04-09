import { describe, it, expect } from 'vitest'
import { parseLatexToBlocks } from '@/lib/latex-parser'

describe('parseLatexToBlocks', () => {
  it('parses a complete exam.cls document', () => {
    const latex = `
\\section{Algebra}
\\begin{questions}
\\question What is $2+2$?
\\begin{choices}
\\choice 3
\\CorrectChoice 4
\\choice 5
\\choice 6
\\end{choices}
\\question What is $3 \\times 3$?
\\begin{choices}
\\choice 6
\\CorrectChoice 9
\\choice 12
\\choice 15
\\end{choices}
\\end{questions}
`
    const result = parseLatexToBlocks(latex)
    expect(result.errors).toHaveLength(0)
    const mcqBlocks = result.blocks.filter((b) => b.type === 'question_select')
    expect(mcqBlocks).toHaveLength(2)
  })

  it('preserves unparseable content as rich_text with warning', () => {
    const latex = '\\begin{weirdenv}\nsome content\n\\end{weirdenv}'
    const result = parseLatexToBlocks(latex)
    expect(result.warnings.length).toBeGreaterThan(0)
    const richTexts = result.blocks.filter((b) => b.type === 'rich_text')
    expect(richTexts.length).toBeGreaterThan(0)
  })

  it('rejects dangerous commands', () => {
    const latex = '\\input{evil.tex}\n\\item Question'
    const result = parseLatexToBlocks(latex)
    expect(result.errors).toHaveLength(1)
    expect(result.blocks).toHaveLength(0)
  })

  it('handles empty input', () => {
    const result = parseLatexToBlocks('')
    expect(result.blocks).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })

  it('handles standalone display math as rich_text with $$ delimiters', () => {
    const latex = '$$\\int_0^1 x^2 dx = \\frac{1}{3}$$'
    const result = parseLatexToBlocks(latex)
    const mathBlocks = result.blocks.filter((b) => b.type === 'rich_text' && b.value.includes('$$'))
    expect(mathBlocks).toHaveLength(1)
  })

  it('handles mixed content with text and questions', () => {
    const latex = `
Solve the following:

\\question What is $x$ if $2x = 10$?
\\begin{choices}
\\choice 3
\\CorrectChoice 5
\\choice 7
\\choice 10
\\end{choices}

Remember to show your work.
`
    const result = parseLatexToBlocks(latex)
    expect(result.blocks.length).toBeGreaterThanOrEqual(2)
  })
})
