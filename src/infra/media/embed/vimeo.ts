/**
 * @fileType utility
 * @domain media
 * @pattern embed-provider
 * @ai-summary Vimeo URL detection, video ID extraction, and oEmbed metadata fetching
 */

import type { EmbedMetadata } from './types'

/**
 * Vimeo URL patterns supported:
 *   - https://vimeo.com/VIDEO_ID
 *   - https://www.vimeo.com/VIDEO_ID
 *   - https://player.vimeo.com/video/VIDEO_ID
 *   - https://vimeo.com/channels/CHANNEL/VIDEO_ID
 *   - https://vimeo.com/groups/GROUP/videos/VIDEO_ID
 *   - https://vimeo.com/VIDEO_ID?h=HASH (private video with hash)
 */
const VIMEO_PATTERNS: RegExp[] = [
  // Standard: vimeo.com/ID
  /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/,
  // Player embed: player.vimeo.com/video/ID
  /(?:https?:\/\/)?player\.vimeo\.com\/video\/(\d+)/,
  // Channel: vimeo.com/channels/CHANNEL/ID
  /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/channels\/[^/]+\/(\d+)/,
  // Group: vimeo.com/groups/GROUP/videos/ID
  /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/groups\/[^/]+\/videos\/(\d+)/,
]

/**
 * Check if a URL is a Vimeo URL.
 */
export function isVimeoUrl(url: string): boolean {
  return VIMEO_PATTERNS.some((pattern) => pattern.test(url))
}

/**
 * Extract the numeric video ID from a Vimeo URL.
 * Returns null if the URL is not a recognized Vimeo format.
 */
export function extractVimeoVideoId(url: string): string | null {
  for (const pattern of VIMEO_PATTERNS) {
    const match = url.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }
  return null
}

/**
 * Build the Vimeo player embed URL.
 * Preserves the ?h= hash parameter required for private videos.
 */
export function buildVimeoEmbedUrl(videoId: string, privateHash?: string | null): string {
  const base = `https://player.vimeo.com/video/${videoId}`
  return privateHash ? `${base}?h=${privateHash}` : base
}

/** Response shape from Vimeo's public oEmbed API */
interface VimeoOEmbedResponse {
  title: string
  thumbnail_url: string
  thumbnail_url_with_play_button?: string
  author_name: string
  author_url: string
  html: string
}

/**
 * Fetch metadata (title, thumbnail) from Vimeo's public oEmbed endpoint.
 *
 * Does NOT require a Vimeo API key. Called once per media save (in the
 * resolveEmbed beforeChange hook), so rate limits are not a concern.
 *
 * @param videoId - The Vimeo numeric video ID
 * @param privateHash - Optional private hash (?h=...) for password-protected/private videos
 */
export async function fetchVimeoMetadata(
  videoId: string,
  privateHash?: string | null,
): Promise<EmbedMetadata> {
  const embedUrl = buildVimeoEmbedUrl(videoId, privateHash)

  const metadata: EmbedMetadata = {
    provider: 'vimeo',
    videoId,
    embedUrl,
    thumbnailUrl: null,
    title: null,
  }

  try {
    const videoUrl = `https://vimeo.com/${videoId}`
    const oEmbedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(videoUrl)}&width=1280`

    const response = await fetch(oEmbedUrl, {
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      // Private or deleted video — embed may still work with the hash
      return metadata
    }

    const data = (await response.json()) as VimeoOEmbedResponse

    metadata.title = data.title || null
    metadata.thumbnailUrl = data.thumbnail_url || null
  } catch {
    // Network error, timeout, or parse failure
    // Graceful degradation — the embed URL still works
  }

  return metadata
}

/**
 * Full Vimeo resolver: detect, extract, fetch metadata.
 * Returns null if the URL is not a Vimeo URL.
 *
 * @param url - Any URL to check
 */
export async function resolveVimeo(url: string): Promise<EmbedMetadata | null> {
  const videoId = extractVimeoVideoId(url)
  if (!videoId) return null

  // Extract private hash if present (?h=HASH)
  let privateHash: string | null = null
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    privateHash = parsed.searchParams.get('h')
  } catch {
    // Ignore malformed URLs
  }

  return fetchVimeoMetadata(videoId, privateHash)
}
