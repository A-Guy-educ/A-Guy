/**
 * PDF.js Configuration
 *
 * Centralized configuration for PDF.js viewer including CDN URLs,
 * cache settings, and response headers.
 */

import { getExternalStorageUrl } from '@/infra/blob/vercel-blob-adapter'

export const PDFJS_VERSION = '4.4.168'

// Vercel Blob path for PDF.js files
export const PDF_JS_DIR = `pdfjs/${PDFJS_VERSION}`

let _cdnBase: string | null = null

/**
 * Get the CDN base URL for PDF.js assets from Vercel Blob
 * Uses lazy initialization with memoization
 */
export async function getCdnBase(): Promise<string> {
  if (!_cdnBase) {
    const externalUrl = await getExternalStorageUrl()
    _cdnBase = `${externalUrl}/${PDF_JS_DIR}`
  }
  return _cdnBase
}

/**
 * PDF.js viewer asset URLs on Vercel Blob CDN
 * These are hashed URLs from the uploaded viewer files
 */
export async function getViewerUrls(): Promise<{
  html: string
  mjs: string
  css: string
  pdfMjs: string
  pdfWorkerMjs: string
}> {
  const cdnBase = await getCdnBase()
  return {
    html: `${cdnBase}/viewer-I6DnqEMX9W9cwNNvWKm3D8YvXdCzUA.html`,
    mjs: `${cdnBase}/viewer-SyYgQ0jufpmBIqrWX2zGA21kZmurH6.mjs`,
    css: `${cdnBase}/viewer-MgMiA2nNdPgVwb4uc8CAB6Twx6vmUC.css`,
    // Non-hashed pdf.mjs so worker can find pdf.worker.mjs in same directory
    pdfMjs: `${cdnBase}/build/pdf.mjs`,
    // Worker file for server-side PDF processing
    pdfWorkerMjs: `${cdnBase}/build/pdf.worker.mjs`,
  }
}

/**
 * Get the PDF.js worker URL for server-side processing
 * Must be called before using pdfjs-dist for segmentation
 */
export async function getPdfWorkerUrl(): Promise<string> {
  const urls = await getViewerUrls()
  return urls.pdfWorkerMjs
}

// ============================================
// Backward-compatible exports for tests and existing code
// These will be populated on first async call
// ============================================

let _cachedViewerUrls: {
  html: string
  mjs: string
  css: string
  pdfMjs: string
  pdfWorkerMjs: string
} | null = null

/**
 * Synchronous CDN_BASE - lazily populated for backward compatibility
 * @deprecated Use getCdnBase() async function instead
 */
export let CDN_BASE: string = ''

/**
 * Synchronous VIEWER_URLS - lazily populated for backward compatibility
 * @deprecated Use getViewerUrls() async function instead
 */
export let VIEWER_URLS: {
  html: string
  mjs: string
  css: string
  pdfMjs: string
  pdfWorkerMjs: string
} = {
  html: '',
  mjs: '',
  css: '',
  pdfMjs: '',
  pdfWorkerMjs: '',
}

/**
 * Initialize lazy exports (called automatically on first async access)
 * This ensures backward compatibility for synchronous code
 */
export async function initializePdfjsConfig(): Promise<void> {
  const cdnBase = await getCdnBase()
  CDN_BASE = cdnBase

  const urls = await getViewerUrls()
  VIEWER_URLS = urls
  _cachedViewerUrls = urls
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
