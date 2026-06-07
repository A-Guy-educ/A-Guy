/**
 * @fileType utility
 * @domain infra
 * @pattern next-metadata
 * @ai-summary Builds Next.js Metadata from a Payload page document; falls back to a hardcoded template title if doc.meta is absent.
 */

import type { Metadata } from 'next'

import type { Page } from '../../payload-types'

import { mergeOpenGraph } from './mergeOpenGraph'
import { getServerSideURL } from './getURL'

const getImageURL = () => {
  const serverUrl = getServerSideURL()
  return serverUrl + '/website-template-OG.webp'
}

export const generateMeta = async (args: { doc: Partial<Page> | null }): Promise<Metadata> => {
  const { doc } = args

  const ogImage = getImageURL()

  const title = doc?.meta?.title
    ? doc?.meta?.title + ' | Payload Website Template'
    : 'Payload Website Template'

  return {
    description: doc?.meta?.description,
    openGraph: mergeOpenGraph({
      description: doc?.meta?.description || '',
      images: ogImage
        ? [
            {
              url: ogImage,
            },
          ]
        : undefined,
      title,
      url: Array.isArray(doc?.slug) ? doc?.slug.join('/') : '/',
    }),
    title,
  }
}
