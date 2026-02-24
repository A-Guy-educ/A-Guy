/**
 * @fileType hook
 * @domain media
 * @pattern embed-provider
 * @ai-summary beforeChange hook that resolves external URLs to embed metadata.
 *             Called on create and update when type is 'external'.
 */

import type { CollectionBeforeChangeHook } from 'payload'

import { resolveEmbedUrl } from '@/infra/media/embed'
import { MediaType } from '@/infra/media/types'

/**
 * Resolves external URLs to embed metadata.
 *
 * When this hook runs:
 * - On CREATE with type === 'external': Always resolve
 * - On UPDATE with type === 'external' AND externalUrl changed: Re-resolve
 * - On UPDATE with type !== 'external': Clear embed fields (type was changed away from external)
 * - Everything else: Skip (no-op)
 *
 * What it does:
 * 1. Calls resolveEmbedUrl() which tries each provider (YouTube first)
 * 2. Populates embedProvider, embedVideoId, embedUrl, embedTitle, embedThumbnailUrl
 * 3. If the oEmbed fetch fails, the embed fields still get populated with what we have
 *    (at minimum: provider and embedUrl)
 */
export const resolveEmbedHook: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const type = data?.type
  const externalUrl = data?.externalUrl

  // --- Case 1: Not an external type ---
  // If the type was changed AWAY from external, clear embed fields
  if (type !== MediaType.External) {
    if (originalDoc?.embedProvider) {
      // Was external before, now it's not — clear embed data
      data.embedProvider = null
      data.embedVideoId = null
      data.embedUrl = null
      data.embedTitle = null
      data.embedThumbnailUrl = null
    }
    return data
  }

  // --- Case 2: External type, but no URL ---
  if (!externalUrl) {
    return data
  }

  // --- Case 3: Update, but URL hasn't changed ---
  if (operation === 'update' && originalDoc?.externalUrl === externalUrl) {
    // URL didn't change, keep existing embed data
    return data
  }

  // --- Case 4: External type with a new/changed URL — resolve it ---
  try {
    req.payload.logger.info(`[Media] Resolving embed URL: ${externalUrl}`)

    const metadata = await resolveEmbedUrl(externalUrl)

    data.embedProvider = metadata.provider
    data.embedVideoId = metadata.videoId
    data.embedUrl = metadata.embedUrl
    data.embedTitle = metadata.title
    data.embedThumbnailUrl = metadata.thumbnailUrl

    req.payload.logger.info(
      `[Media] Resolved embed: provider=${metadata.provider}, videoId=${metadata.videoId}`,
    )
  } catch (error: unknown) {
    // Don't fail the save — just log and leave embed fields empty
    const message = error instanceof Error ? error.message : String(error)
    req.payload.logger.error(`[Media] Failed to resolve embed URL: ${externalUrl} — ${message}`)
  }

  return data
}
