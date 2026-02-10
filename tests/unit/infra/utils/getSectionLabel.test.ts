import { describe, expect, it } from 'vitest'

import { getSectionLabel } from '../../../../src/infra/utils/getSectionLabel'

describe('getSectionLabel', () => {
  it('returns A-J for en locale (0-based index)', () => {
    expect(getSectionLabel({ index: 0, locale: 'en' })).toBe('A')
    expect(getSectionLabel({ index: 1, locale: 'en' })).toBe('B')
    expect(getSectionLabel({ index: 9, locale: 'en' })).toBe('J')
  })

  it('returns א-י for he locale (0-based index)', () => {
    expect(getSectionLabel({ index: 0, locale: 'he' })).toBe('א')
    expect(getSectionLabel({ index: 1, locale: 'he' })).toBe('ב')
    expect(getSectionLabel({ index: 9, locale: 'he' })).toBe('י')
  })

  it('returns null for out-of-range indexes (A-J / א-י only)', () => {
    expect(getSectionLabel({ index: -1, locale: 'en' })).toBeNull()
    expect(getSectionLabel({ index: 10, locale: 'en' })).toBeNull()
    expect(getSectionLabel({ index: 999, locale: 'he' })).toBeNull()
  })

  it('returns null for non-integer indexes (hide badge on fallback)', () => {
    expect(getSectionLabel({ index: 1.5, locale: 'en' })).toBeNull()
    expect(getSectionLabel({ index: Number.NaN, locale: 'en' })).toBeNull()
  })

  it('returns null for unknown locales (hide badge on fallback)', () => {
    expect(getSectionLabel({ index: 0, locale: 'fr' })).toBeNull()
  })
})
