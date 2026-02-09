// @vitest-environment jsdom
import { wrapNumericFractions } from '@/app/(frontend)/ask/_components/AskContent'
import { describe, expect, it } from 'vitest'

describe('wrapNumericFractions', () => {
  it('converts plain numeric fraction 1/2 to LaTeX', () => {
    expect(wrapNumericFractions('1/2')).toBe('$\\frac{1}{2}$')
  })

  it('converts spaced fraction 3/4 to LaTeX', () => {
    expect(wrapNumericFractions(' 3 / 4 ')).toBe(' $\\frac{3}{4}$ ')
  })

  it('does not change non-numeric fraction x/3', () => {
    expect(wrapNumericFractions('x/3')).toBe('x/3')
  })

  it('does not change algebraic fraction (x+1)/(x-2)', () => {
    expect(wrapNumericFractions('(x+1)/(x-2)')).toBe('(x+1)/(x-2)')
  })

  it('does not change URL with slashes', () => {
    expect(wrapNumericFractions('http://a.com/1/2')).toBe('http://a.com/1/2')
  })

  it('does not change already wrapped fraction', () => {
    expect(wrapNumericFractions('already $\\frac{1}{2}$')).toBe('already $\\frac{1}{2}$')
  })
})
