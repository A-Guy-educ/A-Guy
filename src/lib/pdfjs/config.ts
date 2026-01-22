/**
 * PDF.js Configuration
 *
 * Centralized configuration for PDF.js viewer including CDN URLs,
 * cache settings, and response headers.
 */

export const PDFJS_VERSION = '4.4.168'

export const CDN_BASE = `https://96hg0ck1hvrndmxp.public.blob.vercel-storage.com/pdfjs/${PDFJS_VERSION}`

/**
 * PDF.js viewer asset URLs on Vercel Blob CDN
 * These are hashed URLs from the uploaded viewer files
 */
export const VIEWER_URLS = {
  html: `${CDN_BASE}/viewer-I6DnqEMX9W9cwNNvWKm3D8YvXdCzUA.html`,
  mjs: `${CDN_BASE}/viewer-SyYgQ0jufpmBIqrWX2zGA21kZmurH6.mjs`,
  css: `${CDN_BASE}/viewer-MgMiA2nNdPgVwb4uc8CAB6Twx6vmUC.css`,
  // Non-hashed pdf.mjs so worker can find pdf.worker.mjs in same directory
  pdfMjs: `${CDN_BASE}/build/pdf.mjs`,
} as const

/**
 * Cache configuration
 */
export const CACHE_CONFIG = {
  // Revalidate cached content after 1 hour
  revalidateSeconds: 3600,
  // Cache-Control header for client/CDN caching
  cacheControl: 'public, max-age=3600, s-maxage=3600',
} as const

/**
 * Response headers for iframe embedding
 */
export const RESPONSE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': CACHE_CONFIG.cacheControl,
  'Access-Control-Allow-Origin': '*',
  'X-Content-Type-Options': 'nosniff',
  'Content-Disposition': 'inline',
} as const

/**
 * File URL validation configuration
 */
export const VALIDATION_CONFIG = {
  // Maximum length for file URL parameter
  maxUrlLength: 2048,
  // Allowed URL schemes
  allowedSchemes: ['http:', 'https:'] as const,
  // Blocked URL schemes
  blockedSchemes: ['javascript:', 'data:', 'file:', 'blob:', 'ftp:', 'ftps:'] as const,
} as const

/**
 * PDF.js annotation editor modes
 * See: https://github.com/mozilla/pdf.js/blob/master/web/app_options.js
 */
export const ANNOTATION_EDITOR_MODES = {
  NONE: 0,
  FREETEXT: 1,
  INK: 2,
  STAMP: 3,
  HIGHLIGHT: 15,
} as const

/**
 * Allowed annotation editor mode values (allowlist for security)
 */
export const ALLOWED_EDITOR_MODES = [
  ANNOTATION_EDITOR_MODES.NONE,
  ANNOTATION_EDITOR_MODES.FREETEXT,
  ANNOTATION_EDITOR_MODES.INK,
  ANNOTATION_EDITOR_MODES.STAMP,
  ANNOTATION_EDITOR_MODES.HIGHLIGHT,
] as const

/**
 * Get full PDF.js configuration object
 */
export function getPdfjsConfig() {
  return {
    version: PDFJS_VERSION,
    cdnBase: CDN_BASE,
    viewerUrls: VIEWER_URLS,
    cacheConfig: CACHE_CONFIG,
    responseHeaders: RESPONSE_HEADERS,
    validationConfig: VALIDATION_CONFIG,
    annotationEditorModes: ANNOTATION_EDITOR_MODES,
    allowedEditorModes: ALLOWED_EDITOR_MODES,
  } as const
}
