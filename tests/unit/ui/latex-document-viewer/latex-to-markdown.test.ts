import { describe, it, expect } from 'vitest'
import { latexToMarkdown } from '@/ui/web/shared/LatexDocumentViewer/latex-to-markdown'

describe('latexToMarkdown', () => {
  it('strips preamble commands', () => {
    const input =
      '\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\nHello\n\\end{document}'
    const result = latexToMarkdown(input)
    expect(result).not.toContain('\\documentclass')
    expect(result).not.toContain('\\usepackage')
    expect(result).toContain('Hello')
  })

  it('converts section commands to markdown headings', () => {
    const input = '\\section{Introduction}\nSome text\n\\subsection{Details}'
    const result = latexToMarkdown(input)
    expect(result).toContain('## Introduction')
    expect(result).toContain('### Details')
  })

  it('converts text formatting commands', () => {
    const input = '\\textbf{bold} and \\textit{italic} and \\emph{emphasized}'
    const result = latexToMarkdown(input)
    expect(result).toContain('**bold**')
    expect(result).toContain('*italic*')
    expect(result).toContain('*emphasized*')
  })

  it('converts list environments to markdown lists', () => {
    const input = '\\begin{itemize}\n\\item First\n\\item Second\n\\end{itemize}'
    const result = latexToMarkdown(input)
    expect(result).toContain('- First')
    expect(result).toContain('- Second')
  })

  it('converts exam question/choices patterns', () => {
    const input =
      '\\begin{questions}\n\\question What is 2+2?\n\\begin{choices}\n\\choice 3\n\\choice 4\n\\end{choices}\n\\end{questions}'
    const result = latexToMarkdown(input)
    expect(result).toContain('**Question:**')
    expect(result).toContain('- 3')
    expect(result).toContain('- 4')
  })

  it('preserves math delimiters for KaTeX rendering', () => {
    const input = 'Solve $x^2 = 4$ and display: $$\\int_0^1 f(x) dx$$'
    const result = latexToMarkdown(input)
    expect(result).toContain('$x^2 = 4$')
    expect(result).toContain('$$\\int_0^1 f(x) dx$$')
  })

  it('handles line breaks and spacing commands', () => {
    const input = 'Line one\\\\Line two\\bigskip\\noindent Line three'
    const result = latexToMarkdown(input)
    expect(result).not.toContain('\\\\')
    expect(result).not.toContain('\\bigskip')
    expect(result).not.toContain('\\noindent')
  })

  it('handles starred section variants', () => {
    const input = '\\section*{Unnumbered Section}'
    const result = latexToMarkdown(input)
    expect(result).toContain('## Unnumbered Section')
  })
})
