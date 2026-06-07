/**
 * @fileType utility
 * @domain infra
 * @pattern metadata-merge
 * @ai-summary Merges caller OG overrides onto brand defaults resolved fresh from getBrand() on every call; safe to call in RSC without caching brand data.
 *
 * Brand resolution is not cached within a request; if getBrand() throws, a hardcoded fallback is used silently.
 */

import type { Metadata } from 'next'

import { getBrand } from '@/brands'

function getDefaultOpenGraph(): Metadata['openGraph'] {
  const b = getBrand().config
  return {
    type: 'website',
    title: b.defaultTitle,
    description: b.description,
    url: b.host,
    siteName: b.name,
    images: [
      {
        url: b.ogImage,
        width: 1200,
        height: 630,
        alt: `${b.name} - ${b.shortDescription}`,
      },
    ],
  }
}

/** Fallback OG defaults when brand resolution fails (should never happen in practice). */
const fallbackOpenGraph: Metadata['openGraph'] = {
  type: 'website',
  siteName: 'A-Guy',
  images: [{ url: '', width: 1200, height: 630, alt: '' }],
}

/**
 * Merges caller-provided OpenGraph overrides onto brand defaults.
 * Brand defaults are read fresh from `getBrand().config` on every call.
 */
export const mergeOpenGraph = (og?: Metadata['openGraph']): Metadata['openGraph'] => {
  const defaults = getDefaultOpenGraph() ?? fallbackOpenGraph
  return {
    ...defaults,
    ...og,
    images: og?.images ? og.images : defaults.images,
  }
}
