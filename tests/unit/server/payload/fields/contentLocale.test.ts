import type { SelectField } from 'payload'
import { describe, expect, it } from 'vitest'
import {
  CONTENT_LOCALES,
  DEFAULT_CONTENT_LOCALE,
  contentLocaleField,
  isValidContentLocale,
} from '@/server/payload/fields/contentLocale'

const field = contentLocaleField as SelectField

describe('contentLocale field config', () => {
  it('should define CONTENT_LOCALES as [en, he]', () => {
    expect(CONTENT_LOCALES).toEqual(['en', 'he'])
  })

  it('should default to he for backward compatibility', () => {
    expect(DEFAULT_CONTENT_LOCALE).toBe('he')
  })

  describe('isValidContentLocale', () => {
    it('should accept valid locales', () => {
      expect(isValidContentLocale('he')).toBe(true)
      expect(isValidContentLocale('en')).toBe(true)
    })

    it('should reject invalid locales', () => {
      expect(isValidContentLocale('zz')).toBe(false)
      expect(isValidContentLocale('')).toBe(false)
      expect(isValidContentLocale('fr')).toBe(false)
    })
  })

  describe('contentLocaleField', () => {
    it('should be a required select field', () => {
      expect(field.name).toBe('locale')
      expect(field.type).toBe('select')
      expect(field.required).toBe(true)
    })

    it('should be indexed', () => {
      expect(field.index).toBe(true)
    })

    it('should default to he', () => {
      expect(field.defaultValue).toBe('he')
    })

    it('should have options for each content locale', () => {
      expect(field.options).toEqual([
        { label: 'EN', value: 'en' },
        { label: 'HE', value: 'he' },
      ])
    })

    it('should be positioned in sidebar', () => {
      expect(field.admin?.position).toBe('sidebar')
    })
  })
})
