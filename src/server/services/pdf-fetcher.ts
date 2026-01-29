import { PDF_MAX_BYTES } from '@/server/config/constants'
import * as fs from 'fs'
import * as path from 'path'
import { getUploadDir } from '@/server/config/constants'

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
 * Get PDF file path via direct filesystem access (same as Chat Media Upload)
 * NO proxy endpoint - direct absoluteFilePath resolution
 */
export async function getPdfAbsolutePath(mediaId: string, payload: any): Promise<string> {
  // Fetch media document
  const media = await payload.findByID({ collection: 'media', id: mediaId, depth: 0 })

  if (!media) {
    throw stageError('MEDIA_NOT_FOUND', `Media not found: ${mediaId}`)
  }

  // Validate mime type
  if (media.mimeType !== 'application/pdf') {
    throw stageError('NOT_PDF', `Expected application/pdf, got ${media.mimeType}`)
  }

  // Resolve absolute file path
  const uploadDir = getUploadDir()
  const filePath = path.join(uploadDir, media.filename)

  // Check file exists
  if (!fs.existsSync(filePath)) {
    throw stageError('FETCH_FAILED', 'File not found in storage')
  }

  // Validate PDF magic bytes
  const fd = fs.openSync(filePath, 'r')
  const magicBuffer = Buffer.alloc(4)
  fs.readSync(fd, magicBuffer, 0, 4, 0)
  fs.closeSync(fd)

  if (magicBuffer.toString('ascii') !== '%PDF') {
    throw stageError('INVALID_PDF', 'Invalid PDF magic bytes')
  }

  return filePath
}

/**
 * Get PDF file size (for validation)
 * v2.1 Fix 4: Enforce size limit in BOTH code paths (db field and fs fallback)
 */
export async function getPdfFileSize(mediaId: string, payload: any): Promise<number> {
  const media = await payload.findByID({ collection: 'media', id: mediaId, depth: 0 })

  if (!media) {
    throw stageError('MEDIA_NOT_FOUND', `Media not found: ${mediaId}`)
  }

  let filesize = media.filesize as number

  // Fallback: if filesize is missing, resolve filePath and calculate from file system
  if (filesize === undefined || filesize === null) {
    const uploadDir = getUploadDir()
    const filePath = path.join(uploadDir, media.filename)
    const stats = fs.statSync(filePath)
    filesize = stats.size
  }

  // v2.1 Fix 4: Enforce size limit in BOTH code paths
  if (filesize > PDF_MAX_BYTES) {
    throw stageError('PDF_TOO_LARGE', `Size ${filesize} exceeds limit ${PDF_MAX_BYTES}`)
  }

  return filesize
}

/**
 * Map proxy errors to stage errors (for compatibility with existing error handling)
 */
export function mapProxyErrorToStage(proxyCode: string): string {
  return PROXY_TO_STAGE[proxyCode] || 'MEDIA_FETCH_FAILED'
}
