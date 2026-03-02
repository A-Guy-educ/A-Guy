import { describe, expect, it } from 'vitest'
import { resolveContentLocale } from '@/server/services/content-locale-context'

describe('resolveContentLocale', () => {
  it('should return explicit locale when valid', () => {
    const result = resolveContentLocale({ explicit: 'en' })
    expect(result).toEqual({ locale: 'en', source: 'explicit' })
  })

  it('should return course locale when no explicit', () => {
    const result = resolveContentLocale({ courseLocale: 'he' })
    expect(result).toEqual({ locale: 'he', source: 'course' })
  })

  it('should return default when nothing provided', () => {
    const result = resolveContentLocale({})
    expect(result).toEqual({ locale: 'he', source: 'default' })
  })

  it('should fall back to default when explicit locale is invalid', () => {
    const result = resolveContentLocale({ explicit: 'zz' })
    expect(result).toEqual({ locale: 'he', source: 'default' })
  })

  it('should prefer explicit over course locale', () => {
    const result = resolveContentLocale({ explicit: 'en', courseLocale: 'he' })
    expect(result).toEqual({ locale: 'en', source: 'explicit' })
  })

  it('should use custom default when provided and valid', () => {
    const result = resolveContentLocale({ defaultLocale: 'en' })
    expect(result).toEqual({ locale: 'en', source: 'default' })
  })

  it('should ignore invalid custom default', () => {
    const result = resolveContentLocale({ defaultLocale: 'zz' })
    expect(result).toEqual({ locale: 'he', source: 'default' })
  })
})
