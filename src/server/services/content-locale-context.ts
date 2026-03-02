/**
 * Content locale resolution
 *
 * Resolves which content locale to use from explicit sources.
 * Does NOT read from NEXT_LOCALE cookie — that's for UI language only.
 */
import {
  type ContentLocale,
  DEFAULT_CONTENT_LOCALE,
  isValidContentLocale,
} from '@/server/payload/fields/contentLocale'

interface ContentLocaleSources {
  explicit?: string
  courseLocale?: string
  defaultLocale?: string
}

interface ContentLocaleResult {
  locale: ContentLocale
  source: string
}

export function resolveContentLocale(sources: ContentLocaleSources): ContentLocaleResult {
  if (sources.explicit && isValidContentLocale(sources.explicit)) {
    return { locale: sources.explicit, source: 'explicit' }
  }

  if (sources.courseLocale && isValidContentLocale(sources.courseLocale)) {
    return { locale: sources.courseLocale, source: 'course' }
  }

  const fallback =
    sources.defaultLocale && isValidContentLocale(sources.defaultLocale)
      ? sources.defaultLocale
      : DEFAULT_CONTENT_LOCALE

  return { locale: fallback, source: 'default' }
}
