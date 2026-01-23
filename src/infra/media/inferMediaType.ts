import { MediaType, MIME_ALLOWLISTS } from './types'

/**
 * Infer MediaType from MIME type
 * Returns 'other' for unrecognized MIME types
 */
export function inferMediaType(
  mimeType: string | null | undefined,
  _filename?: string | null,
): MediaType {
  if (!mimeType) return MediaType.Other

  const normalized = mimeType.toLowerCase().trim()

  // Check each type's allowlist
  for (const [type, allowlist] of Object.entries(MIME_ALLOWLISTS)) {
    if (allowlist.includes(normalized)) {
      return type as MediaType
    }
  }

  // Prefix fallback for variants
  if (normalized.startsWith('image/')) return MediaType.Image
  if (normalized.startsWith('video/')) return MediaType.Video
  if (normalized.startsWith('audio/')) return MediaType.Audio

  // Unrecognized → other
  return MediaType.Other
}

/**
 * Validate MIME type against allowlist for a given type
 */
export function validateMimeType(mimeType: string, mediaType: MediaType): boolean {
  const allowlist = MIME_ALLOWLISTS[mediaType]
  return allowlist.includes(mimeType.toLowerCase().trim())
}
