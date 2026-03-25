export enum MediaType {
  Image = 'image',
  Video = 'video',
  Audio = 'audio',
  PDF = 'pdf',
  SVG = 'svg',
  Document = 'document',
  External = 'external',
  Other = 'other',
}

// MIME type allowlists per type
export const MIME_ALLOWLISTS: Record<MediaType, string[]> = {
  [MediaType.Image]: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/heic',
    'image/heif',
    'image/gif',
  ],
  [MediaType.Video]: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/avi'],
  [MediaType.Audio]: [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/m4a',
    'audio/x-m4a',
    'audio/aac',
  ],
  [MediaType.PDF]: ['application/pdf'],
  [MediaType.SVG]: ['image/svg+xml'],
  [MediaType.Document]: [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'text/x-tex',
    'application/x-tex',
    'application/x-latex',
  ],
  [MediaType.External]: [], // No file upload
  [MediaType.Other]: [], // Catch-all
}

// Size limits (bytes)
export const SIZE_LIMITS: Record<MediaType, number> = {
  [MediaType.Image]: 10 * 1024 * 1024, // 10MB
  [MediaType.Video]: 100 * 1024 * 1024, // 100MB
  [MediaType.Audio]: 50 * 1024 * 1024, // 50MB
  [MediaType.PDF]: 20 * 1024 * 1024, // 20MB
  [MediaType.SVG]: 2 * 1024 * 1024, // 2MB
  [MediaType.Document]: 20 * 1024 * 1024, // 20MB
  [MediaType.External]: 0, // No file
  [MediaType.Other]: 50 * 1024 * 1024, // 50MB fallback
}
