import { describe, expect, it } from 'vitest'
import { localeWhereClause } from '@/server/payload/fields/contentLocale'

describe('localeWhereClause', () => {
  it('returns an OR clause matching the locale or default locale (backwards compat)', () => {
    const result = localeWhereClause('he')

    expect(result).toEqual({
      or: [{ locale: { equals: 'he' } }, { locale: { equals: 'he' } }],
    })
  })

  it('works with "en" locale (falls back to default "he" for legacy docs)', () => {
    const result = localeWhereClause('en')

    expect(result).toEqual({
      or: [{ locale: { equals: 'en' } }, { locale: { equals: 'he' } }],
    })
  })
})
