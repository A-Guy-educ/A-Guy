/**
 * Locale-aware query helpers
 *
 * Accept explicit locale parameter — never infer from UI language cookie.
 */
import { logger } from '@/infra/utils/logger'
import {
  type ContentLocale,
  DEFAULT_CONTENT_LOCALE,
  isValidContentLocale,
} from '@/server/payload/fields/contentLocale'
import type { Payload, Where } from 'payload'

function requireLocale(locale: unknown): ContentLocale {
  if (!locale || typeof locale !== 'string' || !locale.trim()) {
    if (process.env.NODE_ENV !== 'production') {
      throw new Error('Content locale is required for content queries')
    }
    logger.warn('Content locale missing in query helper, using default')
    return DEFAULT_CONTENT_LOCALE
  }
  if (!isValidContentLocale(locale)) {
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(`Invalid content locale: '${locale}'`)
    }
    logger.warn({ locale }, 'Invalid content locale, using default')
    return DEFAULT_CONTENT_LOCALE
  }
  return locale
}

export async function findCoursesByLocale(
  payload: Payload,
  locale: ContentLocale,
  options?: { limit?: number; page?: number; where?: Where },
) {
  const validLocale = requireLocale(locale)
  return payload.find({
    collection: 'courses',
    where: {
      and: [{ locale: { equals: validLocale } }, ...(options?.where ? [options.where] : [])],
    },
    limit: options?.limit,
    page: options?.page,
  })
}

export async function findPagesByLocale(
  payload: Payload,
  locale: ContentLocale,
  options?: { limit?: number; page?: number; where?: Where },
) {
  const validLocale = requireLocale(locale)
  return payload.find({
    collection: 'pages',
    where: {
      and: [{ locale: { equals: validLocale } }, ...(options?.where ? [options.where] : [])],
    },
    limit: options?.limit,
    page: options?.page,
  })
}

export async function findPostsByLocale(
  payload: Payload,
  locale: ContentLocale,
  options?: { limit?: number; page?: number; where?: Where },
) {
  const validLocale = requireLocale(locale)
  return payload.find({
    collection: 'posts',
    where: {
      and: [{ locale: { equals: validLocale } }, ...(options?.where ? [options.where] : [])],
    },
    limit: options?.limit,
    page: options?.page,
  })
}

export async function getHeaderVariant(payload: Payload, locale: ContentLocale) {
  const validLocale = requireLocale(locale)
  const header = await payload.findGlobal({ slug: 'header' })
  const variants = header?.variants || []
  const match = variants.find((v) => v.locale === validLocale) || variants[0]
  return match?.navItems || []
}

export async function getFooterVariant(payload: Payload, locale: ContentLocale) {
  const validLocale = requireLocale(locale)
  const footer = await payload.findGlobal({ slug: 'footer' })
  const variants = footer?.variants || []
  const match = variants.find((v) => v.locale === validLocale) || variants[0]
  return match?.navItems || []
}
