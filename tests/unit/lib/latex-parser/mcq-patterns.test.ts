import { describe, it, expect } from 'vitest'
import { parseExamClsMcq } from '@/lib/latex-parser/mcq-exam-cls'
import { parseEnumitemMcq } from '@/lib/latex-parser/mcq-enumitem'
import { parseInlineMcq } from '@/lib/latex-parser/mcq-inline'

describe('parseExamClsMcq', () => {
  it('parses \\question with \\begin{choices}', () => {
    const input =
      '\\question What is $2+2$?\n\\begin{choices}\n\\choice 3\n\\CorrectChoice 4\n\\choice 5\n\\choice 6\n\\end{choices}'
    const block = parseExamClsMcq(input)
    expect(block).not.toBeNull()
    expect(block!.type).toBe('question_select')
    expect(block!.variant).toBe('mcq')
    expect(block!.answer.options).toHaveLength(4)
    expect(block!.answer.correctOptionIds).toHaveLength(1)
    expect(block!.prompt.value).toContain('2+2')
  })

  it('handles multiple \\CorrectChoice marks', () => {
    const input =
      '\\question Select all primes:\n\\begin{choices}\n\\CorrectChoice 2\n\\CorrectChoice 3\n\\choice 4\n\\CorrectChoice 5\n\\end{choices}'
    const block = parseExamClsMcq(input)
    expect(block).not.toBeNull()
    expect(block!.answer.correctOptionIds).toHaveLength(3)
    expect(block!.answer.multiSelect).toBe(true)
  })

  it('returns null for non-matching input', () => {
    expect(parseExamClsMcq('random text')).toBeNull()
  })

  it('handles choices without correct answer marked', () => {
    const input =
      '\\question What is $2+2$?\n\\begin{choices}\n\\choice 3\n\\choice 4\n\\choice 5\n\\end{choices}'
    const block = parseExamClsMcq(input)
    expect(block).not.toBeNull()
    expect(block!.answer.options).toHaveLength(3)
    // No correct answer marked - should still have a correctOptionIds (defaults to first)
    expect(block!.answer.correctOptionIds).toHaveLength(1)
  })
})

describe('parseEnumitemMcq', () => {
  it('parses \\item with \\begin{enumerate}[(a)]', () => {
    const input =
      '\\item What is $3 \\times 3$?\n\\begin{enumerate}[(a)]\n\\item 6\n\\item 9\n\\item 12\n\\item 15\n\\end{enumerate}'
    const block = parseEnumitemMcq(input)
    expect(block).not.toBeNull()
    expect(block!.type).toBe('question_select')
    expect(block!.answer.options).toHaveLength(4)
  })

  it('returns null for non-matching input', () => {
    expect(parseEnumitemMcq('random text')).toBeNull()
  })
})

describe('parseInlineMcq', () => {
  it('parses inline (a) (b) (c) (d) options', () => {
    const input = '\\item What is $5-3$?\n(a) 1 \\quad (b) 2 \\quad (c) 3 \\quad (d) 4'
    const block = parseInlineMcq(input)
    expect(block).not.toBeNull()
    expect(block!.answer.options).toHaveLength(4)
  })

  it('handles Hebrew parenthesized options', () => {
    const input = '\\item What is $2+2$?\n(א) 3 \\quad (ב) 4 \\quad (ג) 5 \\quad (ד) 6'
    const block = parseInlineMcq(input)
    expect(block).not.toBeNull()
    expect(block!.answer.options).toHaveLength(4)
  })

  it('returns null for non-matching input', () => {
    expect(parseInlineMcq('random text')).toBeNull()
  })
})
