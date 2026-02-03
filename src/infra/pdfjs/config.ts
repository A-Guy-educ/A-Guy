/**
 * PDF.js Configuration
 *
 * Centralized configuration for PDF.js viewer including CDN URLs,
 * cache settings, and response headers.
 */

export const PDFJS_VERSION = '4.4.168'

export const CDN_BASE = `https://96hg0ck1hvrndmxp.public.blob.vercel-storage.com/pdfjs/${PDFJS_VERSION}`

export const VIEWER_URLS = {
  html: `${CDN_BASE}/viewer-I6DnqEMX9W9cwNNvWKm3D8YvXdCzUA.html`,
  mjs: `${CDN_BASE}/viewer-SyYgQ0jufpmBIqrWX2zGA21kZmurH6.mjs`,
  css: `${CDN_BASE}/viewer-MgMiA2nNdPgVwb4uc8CAB6Twx6vmUC.css`,
  pdfMjs: `${CDN_BASE}/build/pdf.mjs`,
  pdfWorkerMjs: `${CDN_BASE}/build/pdf.worker.mjs`,
}

/**
 * Flexible viewer URLs type - allows both const and test types
 */
export type ViewerUrls = {
  html: string
  mjs: string
  css: string
  pdfMjs: string
  pdfWorkerMjs: string
}

/**
 * Get the PDF.js worker URL for server-side processing
 * Must be called before using pdfjs-dist for segmentation
 */
export async function getPdfWorkerUrl(): Promise<string> {
  return VIEWER_URLS.pdfWorkerMjs
}

/**
 * Synchronous wrapper for VIEWER_URLS - returns the hardcoded viewer URLs
 */
export function getViewerUrls() {
  return VIEWER_URLS
}

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
  } as const
}
