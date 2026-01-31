import { promises as fs } from 'fs'
import path from 'path'

import { getExternalStorageUrl, isVercelBlobUrl } from '@/infra/blob/vercel-blob-adapter'
import { MEDIA_STORAGE_DIR } from '@/infra/config/storage'
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
 * Handles relative URLs by prepending the external storage base URL
 */
export function normalizeToAbsoluteUrl(url: string): string {
  // If already absolute URL (http:// or https://), return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }

  // If it's a relative URL starting with /, prepend external storage base URL
  if (url.startsWith('/')) {
    const baseUrl = getExternalStorageUrl()
    return `${baseUrl}${url}`
  }

  // Otherwise, treat as Vercel Blob URL (should be absolute)
  return url
}

/**
 * Check if a URL is a local media path (relative URL pointing to public/media)
 */
function isLocalMediaPath(url: string): boolean {
  // Local media URLs are relative paths like /media/filename.pdf
  return url.startsWith('/media/') || url.startsWith('/api/media/')
}

/**
 * Extract filename from a local media URL
 */
function extractFilenameFromLocalUrl(url: string): string {
  // Handle /media/filename.pdf or /api/media/file/filename.pdf
  if (url.startsWith('/media/')) {
    return url.replace('/media/', '')
  }
  if (url.startsWith('/api/media/file/')) {
    return url.replace('/api/media/file/', '')
  }
  // Fallback: get last path segment
  return url.split('/').pop() || ''
}

/**
 * Read PDF directly from local filesystem
 */
async function readLocalPdf(url: string): Promise<Buffer> {
  const filename = extractFilenameFromLocalUrl(url)
  if (!filename) {
    throw stageError('FETCH_FAILED', `Could not extract filename from URL: ${url}`)
  }

  const filePath = path.join(MEDIA_STORAGE_DIR, filename)

  try {
    const pdfBuffer = await fs.readFile(filePath)
    return pdfBuffer
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw stageError('MEDIA_NOT_FOUND', `File not found: ${filePath}`)
    }
    throw stageError('FETCH_FAILED', `Failed to read local file: ${error.message}`)
  }
}

/**
 * Get PDF buffer from storage (local filesystem or Vercel Blob)
 * Uses media document's URL to fetch the file
 * Works in both Next.js server context and standalone worker context
 */
export async function getPdfBufferFromBlob(
  mediaId: string,
  payload: any,
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

  try {
    // Check if this is a local file (relative URL) - read directly from filesystem
    if (isLocalMediaPath(media.url)) {
      pdfBuffer = await readLocalPdf(media.url)
    } else if (isVercelBlobUrl(media.url)) {
      // Vercel Blob URL - fetch via HTTP
      const response = await fetch(media.url)
      if (!response.ok) {
        throw stageError(
          'FETCH_FAILED',
          `Failed to fetch PDF: ${response.status} ${response.statusText}`,
        )
      }
      const arrayBuffer = await response.arrayBuffer()
      pdfBuffer = Buffer.from(arrayBuffer)
    } else {
      // Other absolute URL - normalize and fetch
      const normalizedUrl = normalizeToAbsoluteUrl(media.url)
      const response = await fetch(normalizedUrl)
      if (!response.ok) {
        throw stageError(
          'FETCH_FAILED',
          `Failed to fetch PDF: ${response.status} ${response.statusText}`,
        )
      }
      const arrayBuffer = await response.arrayBuffer()
      pdfBuffer = Buffer.from(arrayBuffer)
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
  } catch (error: any) {
    if (error.stage === 'PASS0_EXTRACT') {
      throw error
    }
    throw stageError('FETCH_FAILED', `Failed to fetch PDF: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Get PDF file size (for validation)
 * Uses media document's filesize field or reads from filesystem/fetches to calculate
 */
export async function getPdfFileSize(mediaId: string, payload: any): Promise<number> {
  const media = await payload.findByID({ collection: 'media', id: mediaId, depth: 0 })

  if (!media) {
    throw stageError('MEDIA_NOT_FOUND', `Media not found: ${mediaId}`)
  }

  let filesize = media.filesize as number | undefined

  // If filesize is missing, get it from the file
  if (filesize === undefined || filesize === null) {
    if (!media.url) {
      throw stageError('FETCH_FAILED', 'Media document has no URL')
    }

    try {
      // For local files, use fs.stat
      if (isLocalMediaPath(media.url)) {
        const filename = extractFilenameFromLocalUrl(media.url)
        const filePath = path.join(MEDIA_STORAGE_DIR, filename)
        const stats = await fs.stat(filePath)
        filesize = stats.size
      } else {
        // For remote URLs, try HEAD request first
        const normalizedUrl = isVercelBlobUrl(media.url)
          ? media.url
          : normalizeToAbsoluteUrl(media.url)
        const response = await fetch(normalizedUrl, { method: 'HEAD' })
        if (response.ok) {
          const contentLength = response.headers.get('content-length')
          if (contentLength) {
            filesize = parseInt(contentLength, 10)
          }
        }
      }
    } catch (_error) {
      // Fallback: fetch full file if stat/HEAD fails
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
