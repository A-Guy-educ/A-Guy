import type { Field } from 'payload'

/**
 * Content-level locale constants — independent of UI i18n (src/i18n/config.ts).
 *
 * Content locale controls which language a document is written in.
 * System language (UI i18n) controls button labels, menus, etc.
 * They are separate concerns and may diverge in the future.
 */
export const CONTENT_LOCALES = ['en', 'he'] as const
export type ContentLocale = (typeof CONTENT_LOCALES)[number]
export const DEFAULT_CONTENT_LOCALE: ContentLocale = 'he'

export function isValidContentLocale(value: string): value is ContentLocale {
  return CONTENT_LOCALES.includes(value as ContentLocale)
}

export const contentLocaleField: Field = {
  name: 'locale',
  type: 'select',
  required: true,
  options: CONTENT_LOCALES.map((l) => ({ label: l.toUpperCase(), value: l })),
  index: true,
  defaultValue: DEFAULT_CONTENT_LOCALE,
  admin: {
    position: 'sidebar',
    description: 'Content language',
  },
}
