import { describe, it, expect } from 'vitest'
import { sanitizeLatex } from '@/lib/latex-parser/sanitizer'

describe('sanitizeLatex', () => {
  it('passes clean LaTeX through', () => {
    const input = '\\begin{enumerate}\n\\item What is $2+2$?\n\\end{enumerate}'
    const result = sanitizeLatex(input)
    expect(result.safe).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it('rejects \\input command', () => {
    const input = '\\input{secrets.tex}\n\\item Question'
    const result = sanitizeLatex(input)
    expect(result.safe).toBe(false)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].command).toBe('\\input')
    expect(result.violations[0].line).toBe(1)
  })

  it('rejects \\write18 command', () => {
    const result = sanitizeLatex('\\write18{rm -rf /}')
    expect(result.safe).toBe(false)
  })

  it('rejects \\def command', () => {
    const result = sanitizeLatex('\\def\\myinput{\\input}')
    expect(result.safe).toBe(false)
    expect(result.violations[0].command).toBe('\\def')
  })

  it('rejects \\newcommand', () => {
    const result = sanitizeLatex('\\newcommand{\\evil}{\\write18{}}')
    expect(result.safe).toBe(false)
  })

  it('rejects \\catcode', () => {
    const result = sanitizeLatex('\\catcode`\\@=11')
    expect(result.safe).toBe(false)
  })

  it('rejects multiple violations', () => {
    const input = '\\input{a}\n\\include{b}\n\\write18{c}'
    const result = sanitizeLatex(input)
    expect(result.safe).toBe(false)
    expect(result.violations).toHaveLength(3)
  })

  it('handles empty input', () => {
    const result = sanitizeLatex('')
    expect(result.safe).toBe(true)
  })
})
