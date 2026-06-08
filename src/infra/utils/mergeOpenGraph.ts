/**
 * @fileType utility
 * @domain seo
 * @pattern opengraph-merger
 * @ai-summary Merges caller OG overrides onto brand defaults fetched fresh per call; if brand resolution fails, silently falls back to a bare site-name entry with no image.
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
