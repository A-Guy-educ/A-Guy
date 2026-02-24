/**
 * @fileType utility
 * @domain media
 * @pattern embed-provider
 * @ai-summary Type definitions for external media embed providers
 */

/** Supported embed providers. Add new providers here. */
export type EmbedProvider = 'youtube' | 'vimeo' | 'generic'

/** Result of resolving an external URL to embed metadata */
export interface EmbedMetadata {
  /** Which provider was detected */
  provider: EmbedProvider
  /** Provider-specific video/content ID (e.g., YouTube video ID) */
  videoId: string | null
  /** The iframe-ready embed URL (e.g., https://www.youtube-nocookie.com/embed/xxx) */
  embedUrl: string
  /** Thumbnail image URL fetched from the provider */
  thumbnailUrl: string | null
  /** Content title fetched from the provider */
  title: string | null
}

/** Response from YouTube's oEmbed API */
export interface YouTubeOEmbedResponse {
  title: string
  author_name: string
  author_url: string
  thumbnail_url: string
  thumbnail_width: number
  thumbnail_height: number
  html: string
}
