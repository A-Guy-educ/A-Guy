/**
 * @fileType utility
 * @domain media
 * @pattern youtube-detection
 * @ai-summary Client-side YouTube URL detection and embed URL generation (no API calls)
 */

/**
 * YouTube URL patterns supported:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/live/VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 * - With extra query params (t=, list=, si=, etc.)
 */

const YOUTUBE_PATTERNS = [
  // Standard watch URL: youtube.com/watch?v=ID
  /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  // Short URL: youtu.be/ID
  /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
  // Embed URL: youtube.com/embed/ID
  /(?:https?:\/\/)?(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  // Shorts URL: youtube.com/shorts/ID
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  // Live URL: youtube.com/live/ID
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
]

/**
 * Check if a URL is a YouTube video URL.
 */
export function isYouTubeUrl(url: string): boolean {
  if (!url) return false
  return YOUTUBE_PATTERNS.some((pattern) => pattern.test(url))
}

/**
 * Extract the 11-character video ID from a YouTube URL.
 * Returns null if the URL is not a recognized YouTube format.
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null

  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }

  return null
}

/**
 * Get a privacy-enhanced embed URL for a YouTube video.
 * Uses youtube-nocookie.com to avoid tracking cookies.
 * Returns null if the URL is not a YouTube video.
 */
export function getYouTubeEmbedUrl(url: string): string | null {
  const videoId = extractYouTubeVideoId(url)
  if (!videoId) return null

  return `https://www.youtube-nocookie.com/embed/${videoId}`
}
