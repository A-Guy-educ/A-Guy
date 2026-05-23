/**
 * Per-page SEO metadata helper
 *
 * @fileType utility
 * @domain seo
 * @ai-summary Produces Next.js Metadata from per-page overrides merged with brand defaults.
 */

import type { Metadata } from 'next'

import { getBrand } from '@/brands'

/**
 * Input for page metadata. All fields are optional — brand defaults are used when omitted.
 */
export interface PageSeoInput {
  /** Page-specific title (template applied by root generateMetadata). */
  title?: string
  /** Page-specific description. */
  description?: string
  /** Override OG image URL. */
  ogImage?: string
  /** Prevent indexing. */
  noIndex?: boolean
  /** Canonical pathname (used to build absolute URL). */
  pathname?: string
}

/**
 * Returns a complete Metadata object for a page, merging per-page overrides
 * onto brand defaults from `getBrand().config`.
 *
 * @example
 * ```ts
 * // Minimal usage — all values from brand
 * export const metadata = pageMetadata()
 *
 * // With overrides
 * export const metadata = pageMetadata({
 *   title: 'Study',
 *   description: 'Choose a topic to learn',
 * })
 * ```
 */
export function pageMetadata(input: PageSeoInput = {}): Metadata {
  const b = getBrand().config
  const title = input.title ?? b.defaultTitle

  return {
    title,
    description: input.description ?? b.description,
    openGraph: {
      siteName: b.name,
      title,
      description: input.description ?? b.description,
      images: [{ url: input.ogImage ?? b.ogImage }],
      locale: b.locale,
    },
    twitter: {
      card: 'summary_large_image',
      site: b.social.twitterHandle,
      creator: b.social.twitterHandle,
      title,
      description: input.description ?? b.description,
      images: [{ url: input.ogImage ?? b.ogImage }],
    },
    robots: input.noIndex ? { index: false, follow: false } : undefined,
  }
}
