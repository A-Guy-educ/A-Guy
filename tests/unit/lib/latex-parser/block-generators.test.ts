import { describe, it, expect } from 'vitest'
import {
  makeRichTextBlock,
  makeLatexBlock,
  makeInlineRichText,
  makeMcqBlock,
} from '@/lib/latex-parser/block-generators'

describe('makeRichTextBlock', () => {
  it('creates a valid RichTextBlock', () => {
    const block = makeRichTextBlock('Some **markdown** with $math$')
    expect(block.type).toBe('rich_text')
    expect(block.format).toBe('md-math-v1')
    expect(block.value).toBe('Some **markdown** with $math$')
    expect(block.id).toBeTruthy()
    expect(block.mediaIds).toEqual([])
  })

  it('generates unique ids for each call', () => {
    const a = makeRichTextBlock('a')
    const b = makeRichTextBlock('b')
    expect(a.id).not.toBe(b.id)
  })
})

describe('makeLatexBlock', () => {
  it('creates a valid LatexBlock', () => {
    const block = makeLatexBlock('\\frac{1}{2}')
    expect(block.type).toBe('latex')
    expect(block.latex).toBe('\\frac{1}{2}')
    expect(block.renderMode).toBe('block')
    expect(block.id).toBeTruthy()
  })

  it('generates unique ids for each call', () => {
    const a = makeLatexBlock('x')
    const b = makeLatexBlock('y')
    expect(a.id).not.toBe(b.id)
  })
})

describe('makeInlineRichText', () => {
  it('creates a valid InlineRichText without id', () => {
    const inline = makeInlineRichText('hello $x$')
    expect(inline.type).toBe('rich_text')
    expect(inline.format).toBe('md-math-v1')
    expect(inline.value).toBe('hello $x$')
    expect(inline.mediaIds).toEqual([])
    expect((inline as unknown as Record<string, unknown>).id).toBeUndefined()
  })
})

describe('makeMcqBlock', () => {
  it('creates a single-select MCQ block', () => {
    const block = makeMcqBlock('What is 2+2?', [
      { text: '3', isCorrect: false },
      { text: '4', isCorrect: true },
    ])
    expect(block.type).toBe('question_select')
    expect(block.variant).toBe('mcq')
    expect(block.selectionMode).toBe('single')
    expect(block.id).toBeTruthy()
    expect(block.answer.options).toHaveLength(2)
    expect(block.answer.correctOptionIds).toHaveLength(1)
    expect(block.answer.multiSelect).toBe(false)
    expect(block.prompt.value).toBe('What is 2+2?')
  })

  it('creates a multi-select MCQ block when multiple correct options', () => {
    const block = makeMcqBlock('Select even numbers', [
      { text: '1', isCorrect: false },
      { text: '2', isCorrect: true },
      { text: '4', isCorrect: true },
    ])
    expect(block.selectionMode).toBe('multiple')
    expect(block.answer.multiSelect).toBe(true)
    expect(block.answer.correctOptionIds).toHaveLength(2)
  })

  it('falls back to first option id when no correct option provided', () => {
    const block = makeMcqBlock('Pick one', [
      { text: 'A', isCorrect: false },
      { text: 'B', isCorrect: false },
    ])
    expect(block.answer.correctOptionIds).toHaveLength(1)
    expect(block.answer.correctOptionIds[0]).toBe(block.answer.options[0].id)
  })
})
