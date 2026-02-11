export const locales = ['en', 'he'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'he'

export const localeDetection = true

export const cookieName = 'NEXT_LOCALE'

// RTL locales set
export const rtlLocales: ReadonlySet<Locale> = new Set(['he'])

// Direction type
export type Direction = 'ltr' | 'rtl'

// Locale direction map
export const localeDirections: Record<Locale, Direction> = {
  en: 'ltr',
  he: 'rtl',
}

// Utility functions
export function isRTL(locale: Locale): boolean {
  return rtlLocales.has(locale)
}

export function getDirection(locale: Locale): Direction {
  return isRTL(locale) ? 'rtl' : 'ltr'
}

export function detectBrowserLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale

  const browserLang = window.navigator.language
  const detected = locales.find((loc) => browserLang.startsWith(loc))
  return detected ?? defaultLocale
}

// Subdomain locale detection
export function getLocaleFromSubdomain(host: string): Locale | null {
  for (const locale of locales) {
    if (host.startsWith(`${locale}.`)) {
      return locale
    }
  }
  return null
}

export function isForcedLocaleDomain(host: string): boolean {
  return locales.some((locale) => host.startsWith(`${locale}.`))
}
