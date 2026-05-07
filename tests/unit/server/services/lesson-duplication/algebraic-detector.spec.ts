/**
 * Unit tests for src/server/services/lesson-duplication/strategies/algebraic-detector.ts
 */
import { describe, expect, it } from 'vitest'

import { isPurelyAlgebraic } from '@/server/services/lesson-duplication/strategies/algebraic-detector'

describe('isPurelyAlgebraic', () => {
  it('treats a bare arithmetic question as algebraic', () => {
    expect(isPurelyAlgebraic({ text: '2 + 3 = ?' })).toBe(true)
  })

  it('accepts whitelisted Hebrew imperative + arithmetic', () => {
    expect(isPurelyAlgebraic({ text: 'חשב 5 × 4' })).toBe(true)
  })

  it('accepts whitelisted English imperative + arithmetic', () => {
    expect(isPurelyAlgebraic({ text: 'Compute 12 / 3' })).toBe(true)
  })

  it('rejects when text contains words outside the whitelist', () => {
    expect(isPurelyAlgebraic({ text: 'A train travels 100 km/h. How long...?' })).toBe(false)
  })

  it('rejects when text has no number at all', () => {
    expect(isPurelyAlgebraic({ text: 'חשב את התשובה' })).toBe(false)
  })

  it('rejects when SVG is present', () => {
    expect(
      isPurelyAlgebraic({ text: '5 + 3', svg: '<svg><rect width="10" height="10"/></svg>' }),
    ).toBe(false)
  })

  it('accepts when SVG field is empty string', () => {
    expect(isPurelyAlgebraic({ text: '5 + 3', svg: '' })).toBe(true)
  })

  it('rejects when a table has rows', () => {
    expect(
      isPurelyAlgebraic({
        text: '5 + 3',
        table: { headers: ['a'], rows_data: [[1, 2]] },
      }),
    ).toBe(false)
  })

  it('accepts an empty exercise (vacuously algebraic)', () => {
    expect(isPurelyAlgebraic({})).toBe(true)
  })

  it('rejects when a section has SVG', () => {
    expect(
      isPurelyAlgebraic({
        text: '2 + 2',
        sections: [{ text: '3 + 3', svg: '<svg/>' }],
      }),
    ).toBe(false)
  })

  it('rejects when a section text contains non-whitelist words', () => {
    expect(
      isPurelyAlgebraic({
        text: '2 + 2',
        sections: [{ text: 'A boat travels 5 km' }],
      }),
    ).toBe(false)
  })

  it('accepts a multi-section pure-arithmetic exercise', () => {
    expect(
      isPurelyAlgebraic({
        text: 'חשב',
        sections: [{ text: '5 + 3' }, { text: '12 / 4' }, { text: '7 × 7' }],
      }),
    ).toBe(true)
  })
})
