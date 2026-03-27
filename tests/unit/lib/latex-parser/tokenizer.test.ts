import { describe, it, expect } from 'vitest'
import { tokenize } from '@/lib/latex-parser/tokenizer'

describe('tokenize', () => {
  it('tokenizes plain text', () => {
    const tokens = tokenize('Hello world')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('text')
    expect(tokens[0].value).toBe('Hello world')
  })

  it('tokenizes an environment', () => {
    const tokens = tokenize('\\begin{enumerate}\n\\item A\n\\end{enumerate}')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('environment')
    expect(tokens[0].name).toBe('enumerate')
  })

  it('tokenizes inline math', () => {
    const tokens = tokenize('The answer is $x^2$.')
    expect(tokens).toHaveLength(3)
    expect(tokens[0].type).toBe('text')
    expect(tokens[1].type).toBe('math')
    expect(tokens[1].value).toBe('$x^2$')
    expect(tokens[2].type).toBe('text')
  })

  it('tokenizes display math', () => {
    const tokens = tokenize('$$\\frac{1}{2}$$')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('math')
  })

  it('tokenizes commands', () => {
    const tokens = tokenize('\\section{Title}')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('command')
    expect(tokens[0].name).toBe('section')
  })

  it('tokenizes mixed content', () => {
    const input =
      '\\section{Algebra}\nSolve $x+1=0$.\n\\begin{choices}\n\\choice 1\n\\choice -1\n\\end{choices}'
    const tokens = tokenize(input)
    expect(tokens.length).toBeGreaterThan(1)
  })

  it('handles nested environments', () => {
    const input =
      '\\begin{questions}\n\\question\n\\begin{choices}\n\\choice A\n\\end{choices}\n\\end{questions}'
    const tokens = tokenize(input)
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('environment')
    expect(tokens[0].name).toBe('questions')
  })

  it('strips LaTeX comments', () => {
    const tokens = tokenize('text % this is a comment\nmore text')
    const allText = tokens.map((t) => t.value).join('')
    expect(allText).not.toContain('comment')
  })
})
