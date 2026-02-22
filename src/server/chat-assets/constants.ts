/**
 * Chat Assets Constants
 * Constants for chat-asset uploads (direct-to-Vercel-Blob)
 */

export const CHAT_ASSET_MAX_BYTES = 20 * 1024 * 1024 // 20MB

export const CHAT_ASSET_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const

export const CHAT_ASSET_MAX_ATTACHMENTS = 5

export const CHAT_ASSET_UPLOAD_SESSION_TTL_HOURS = 24

export const CHAT_ASSET_RETENTION_DAYS = 30

export const CHAT_ASSET_TOKEN_VALID_MINUTES = 10
