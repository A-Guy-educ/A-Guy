import type { Payload } from 'payload'
import { getPdfBufferFromUrl, isVercelBlobUrl } from '@/infra/blob/vercel-blob-adapter'
import { fetchBuffer } from '@/infra/utils/http'
import { PDF_MAX_BYTES } from '@/server/config/constants'

export interface PDFExtractError {
  stage: 'PASS0_EXTRACT'
  code: string
  message: string
}

function stageError(code: string, message: string): PDFExtractError {
  return { stage: 'PASS0_EXTRACT', code, message }
}

const PROXY_TO_STAGE: Record<string, string> = {
  MEDIA_NOT_FOUND: 'MEDIA_NOT_FOUND',
  NOT_PDF: 'NOT_PDF',
  INVALID_PDF: 'INVALID_PDF',
  PDF_TOO_LARGE: 'PDF_TOO_LARGE',
  UNAUTHORIZED: 'MEDIA_ACCESS_DENIED',
  FETCH_FAILED: 'MEDIA_FETCH_FAILED',
  INTERNAL_ERROR: 'MEDIA_FETCH_FAILED',
}

/**
 * Normalize URL to absolute URL
 * Returns absolute URLs as-is (Vercel Blob URLs)
 * For relative URLs, prepends the production server URL
 */
export async function normalizeToAbsoluteUrl(url: string): Promise<string> {
  // If already absolute URL (http:// or https://), return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }

  // For relative URLs, prepend the production server URL
  // Use VERCEL_PROJECT_PRODUCTION_URL or NEXT_PUBLIC_SERVER_URL
  if (url.startsWith('/')) {
    let baseUrl: string
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
      baseUrl = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    } else if (process.env.NEXT_PUBLIC_SERVER_URL) {
      baseUrl = process.env.NEXT_PUBLIC_SERVER_URL
    } else {
      // Fallback to localhost for development
      baseUrl = 'http://localhost:3000'
    }
    return `${baseUrl}${url}`
  }

  // Treat as-is for any other case
  return url
}

/**
 * Get PDF buffer from storage
 * Handles Vercel Blob URLs, Payload API endpoints, and external URLs
 */
export async function getPdfBufferFromBlob(
  mediaId: string,
  payload: Payload,
  _req?: { headers?: { authorization?: string; cookie?: string } },
): Promise<Buffer> {
  // Fetch media document
  const media = await payload.findByID({ collection: 'media', id: mediaId, depth: 0 })

  if (!media) {
    throw stageError('MEDIA_NOT_FOUND', `Media not found: ${mediaId}`)
  }

  // Validate mime type
  if (media.mimeType !== 'application/pdf') {
    throw stageError('NOT_PDF', `Expected application/pdf, got ${media.mimeType}`)
  }

  // Fetch the file from storage using the URL
  if (!media.url) {
    throw stageError('FETCH_FAILED', 'Media document has no URL')
  }

  let pdfBuffer: Buffer

  if (isVercelBlobUrl(media.url)) {
    // Vercel Blob URL - fetch directly from blob storage
    pdfBuffer = await getPdfBufferFromUrl(media.url)
  } else {
    // Relative URL or other absolute URL - normalize and fetch
    const normalizedUrl = await normalizeToAbsoluteUrl(media.url)

    // Build auth headers from request if provided
    const headers: Record<string, string> = {}
    if (_req?.headers?.authorization) {
      headers['Authorization'] = _req.headers.authorization
    }
    if (_req?.headers?.cookie) {
      headers['Cookie'] = _req.headers.cookie
    }

    pdfBuffer = await fetchBuffer(normalizedUrl, 30000, headers)
  }

  // Validate size
  if (pdfBuffer.length > PDF_MAX_BYTES) {
    throw stageError('PDF_TOO_LARGE', `Size ${pdfBuffer.length} exceeds limit ${PDF_MAX_BYTES}`)
  }

  // Validate PDF magic bytes
  if (pdfBuffer.length < 4) {
    throw stageError('INVALID_PDF', 'PDF file too small')
  }

  const magicBytes = pdfBuffer.slice(0, 4).toString('ascii')
  if (magicBytes !== '%PDF') {
    throw stageError('INVALID_PDF', 'Invalid PDF magic bytes')
  }

  return pdfBuffer
}

/**
 * Get PDF file size (for validation)
 * Uses media document's filesize field or fetches to calculate
 */
export async function getPdfFileSize(mediaId: string, payload: Payload): Promise<number> {
  const media = await payload.findByID({ collection: 'media', id: mediaId, depth: 0 })

  if (!media) {
    throw stageError('MEDIA_NOT_FOUND', `Media not found: ${mediaId}`)
  }

  let filesize = media.filesize as number | undefined

  // If filesize is missing, fetch to calculate
  if (filesize === undefined || filesize === null) {
    if (!media.url) {
      throw stageError('FETCH_FAILED', 'Media document has no URL')
    }

    try {
      // Determine URL for HEAD request
      let url: string
      if (isVercelBlobUrl(media.url)) {
        url = media.url
      } else {
        url = await normalizeToAbsoluteUrl(media.url)
      }

      const response = await fetch(url, { method: 'HEAD' })
      if (response.ok) {
        const contentLength = response.headers.get('content-length')
        if (contentLength) {
          filesize = parseInt(contentLength, 10)
        }
      }
    } catch {
      // Fallback: fetch full file if HEAD fails
      const buffer = await getPdfBufferFromBlob(mediaId, payload)
      filesize = buffer.length
    }
  }

  // Enforce size limit
  if (filesize && filesize > PDF_MAX_BYTES) {
    throw stageError('PDF_TOO_LARGE', `Size ${filesize} exceeds limit ${PDF_MAX_BYTES}`)
  }

  return filesize || 0
}

/**
 * Map proxy errors to stage errors (for compatibility with existing error handling)
 */
export function mapProxyErrorToStage(proxyCode: string): string {
  return PROXY_TO_STAGE[proxyCode] || 'MEDIA_FETCH_FAILED'
}
