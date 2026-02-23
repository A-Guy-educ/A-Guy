/**
 * @fileType utility
 * @domain media
 * @pattern embed-provider
 * @ai-summary YouTube URL detection, video ID extraction, and oEmbed metadata fetching
 */

import type { EmbedMetadata, YouTubeOEmbedResponse } from './types'

/**
 * All the URL patterns YouTube uses.
 * Each regex has a capture group for the video ID.
 *
 * Why so many? YouTube has many URL formats:
 *   - https://www.youtube.com/watch?v=VIDEO_ID
 *   - https://youtu.be/VIDEO_ID
 *   - https://www.youtube.com/embed/VIDEO_ID
 *   - https://www.youtube.com/shorts/VIDEO_ID
 *   - https://www.youtube.com/live/VIDEO_ID
 *   - https://m.youtube.com/watch?v=VIDEO_ID (mobile)
 */
const YOUTUBE_PATTERNS: RegExp[] = [
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  /(?:https?:\/\/)?m\.youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
]

/**
 * Check if a URL is a YouTube URL.
 *
 * @param url - The URL to check (e.g., "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
 * @returns true if the URL matches any YouTube pattern
 */
export function isYouTubeUrl(url: string): boolean {
  return YOUTUBE_PATTERNS.some((pattern) => pattern.test(url))
}

/**
 * Extract the 11-character video ID from a YouTube URL.
 *
 * YouTube video IDs are always exactly 11 characters containing:
 * letters (a-z, A-Z), numbers (0-9), hyphens (-), and underscores (_).
 *
 * @param url - A YouTube URL in any supported format
 * @returns The 11-character video ID, or null if not found
 *
 * @example
 * extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ') // 'dQw4w9WgXcQ'
 * extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')                // 'dQw4w9WgXcQ'
 * extractYouTubeVideoId('https://example.com')                          // null
 */
export function extractYouTubeVideoId(url: string): string | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }
  return null
}

/**
 * Convert a YouTube video ID into a privacy-enhanced embed URL.
 *
 * Uses youtube-nocookie.com instead of youtube.com to avoid
 * setting tracking cookies on the user's browser.
 *
 * @param videoId - The 11-character YouTube video ID
 * @returns A full embed URL ready for use in an <iframe> src attribute
 */
export function buildYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`
}

/**
 * Fetch metadata (title, thumbnail) from YouTube's public oEmbed endpoint.
 *
 * This does NOT require a YouTube API key. The oEmbed endpoint is public
 * and rate-limited but sufficient for our use case (called once per media save).
 *
 * @param videoId - The YouTube video ID
 * @returns EmbedMetadata with title and thumbnail, or null fields on failure
 *
 * How oEmbed works:
 * 1. We send a GET request to YouTube's oEmbed URL with the video URL
 * 2. YouTube responds with JSON containing title, author, thumbnail, etc.
 * 3. We extract what we need and return it in our EmbedMetadata format
 */
export async function fetchYouTubeMetadata(videoId: string): Promise<EmbedMetadata> {
  const embedUrl = buildYouTubeEmbedUrl(videoId)

  // Base metadata (always available since we have the video ID)
  const metadata: EmbedMetadata = {
    provider: 'youtube',
    videoId,
    embedUrl,
    thumbnailUrl: null,
    title: null,
  }

  try {
    // YouTube's public oEmbed endpoint — no API key needed
    const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`

    const response = await fetch(oEmbedUrl, {
      // Timeout after 5 seconds — don't block the save if YouTube is slow
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      // Video might be private or deleted — embed will still work, just no metadata
      return metadata
    }

    const data = (await response.json()) as YouTubeOEmbedResponse

    metadata.title = data.title || null
    metadata.thumbnailUrl = data.thumbnail_url || null
  } catch {
    // Network error, timeout, or parsing error
    // This is fine — we still have the embed URL and video ID
    // The embed will work, just without title/thumbnail
  }

  return metadata
}

/**
 * Full YouTube resolver: detect, extract, fetch metadata.
 *
 * This is the main entry point for YouTube URL processing.
 * Returns null if the URL is not a YouTube URL.
 *
 * @param url - Any URL to check
 * @returns Full EmbedMetadata if YouTube URL, or null if not YouTube
 */
export async function resolveYouTube(url: string): Promise<EmbedMetadata | null> {
  const videoId = extractYouTubeVideoId(url)
  if (!videoId) return null

  return fetchYouTubeMetadata(videoId)
}
