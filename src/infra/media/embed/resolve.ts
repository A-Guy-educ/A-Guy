/**
 * @fileType utility
 * @domain media
 * @pattern embed-provider
 * @ai-summary Main entry point for resolving external URLs to embed metadata.
 *             Tries each provider in order, falls back to generic.
 */

import type { EmbedMetadata } from './types'
import { resolveYouTube } from './youtube'
import { resolveVimeo } from './vimeo'

/**
 * Resolve an external URL into embed metadata.
 *
 * How it works:
 * 1. Try each supported provider in order (YouTube first)
 * 2. If a provider matches, return its metadata
 * 3. If no provider matches, return generic metadata (plain iframe)
 *
 * To add a new provider:
 * 1. Create src/infra/media/embed/<provider>.ts with resolve<Provider>()
 * 2. Add the provider name to the EmbedProvider type in types.ts
 * 3. Add resolve<Provider> to the providers array below
 *
 * @param url - The external URL to resolve
 * @returns EmbedMetadata with provider info, embed URL, and optional title/thumbnail
 */
export async function resolveEmbedUrl(url: string): Promise<EmbedMetadata> {
  // Try each provider in order. First match wins.
  // Each resolver returns null if the URL doesn't match its pattern.
  const providers = [resolveYouTube, resolveVimeo]

  for (const resolve of providers) {
    const result = await resolve(url)
    if (result) return result
  }

  // No provider matched — return generic metadata.
  // The URL will be used directly as an iframe src.
  return {
    provider: 'generic',
    videoId: null,
    embedUrl: url,
    thumbnailUrl: null,
    title: null,
  }
}
