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
 * Get PDF buffer from Vercel Blob storage
 * Uses media document's URL to fetch the file
 */
export async function getPdfBufferFromBlob(
  mediaId: string,
  payload: any,
  req?: { headers?: { authorization?: string; cookie?: string } },
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

  // Get file size from media document
  let filesize = media.filesize as number | undefined

  // Fetch the file from Blob storage using the URL
  if (!media.url) {
    throw stageError('FETCH_FAILED', 'Media document has no URL')
  }

  // Prepare headers for authenticated requests (if needed)
  const headers: Record<string, string> = {}
  if (req?.headers?.authorization) {
    headers['Authorization'] = req.headers.authorization
  }
  if (req?.headers?.cookie) {
    headers['Cookie'] = req.headers.cookie
  }

  try {
    const response = await fetch(media.url, { headers })

    if (!response.ok) {
      throw stageError('FETCH_FAILED', `Failed to fetch PDF: ${response.status} ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const pdfBuffer = Buffer.from(arrayBuffer)

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
 * Uses media document's filesize field or fetches to calculate
 */
export async function getPdfFileSize(mediaId: string, payload: any): Promise<number> {
  const media = await payload.findByID({ collection: 'media', id: mediaId, depth: 0 })

  if (!media) {
    throw stageError('MEDIA_NOT_FOUND', `Media not found: ${mediaId}`)
  }

  let filesize = media.filesize as number | undefined

  // If filesize is missing, fetch the file to calculate size
  if (filesize === undefined || filesize === null) {
    if (!media.url) {
      throw stageError('FETCH_FAILED', 'Media document has no URL')
    }

    try {
      const response = await fetch(media.url, { method: 'HEAD' })
      if (response.ok) {
        const contentLength = response.headers.get('content-length')
        if (contentLength) {
          filesize = parseInt(contentLength, 10)
        }
      }
    } catch (error) {
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
