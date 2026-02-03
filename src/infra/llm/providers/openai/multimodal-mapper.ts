/**
 * OpenAI-Compatible Multimodal Mapper
 * Converts MediaPartWithPath to OpenAI-compatible image format (base64 data URLs)
 *
 * @fileType mapper
 * @domain ai
 * @pattern adapter, data-transformation
 */
import type { Payload } from 'payload'

import { isVercelBlobUrl } from '@/infra/blob/vercel-blob-adapter'
import type { MediaPartWithPath } from '@/infra/llm/multimodal/types'
import { logger } from '@/infra/utils/logger'
import { normalizeToAbsoluteUrl } from '@/server/services/pdf-fetcher'

/**
 * Convert validated media parts to OpenAI-compatible format
 * Returns attachments array ready to be sent to OpenAI-compatible API
 */
export async function mapMultimodalToOpenAI(
  mediaPartsWithPath: MediaPartWithPath[],
  payload: Payload,
  req?: { headers: { authorization?: string; cookie?: string } },
): Promise<Array<{ data: string; mimeType: string }>> {
  const attachments: Array<{ data: string; mimeType: string }> = []

  logger.info(
    { mediaCount: mediaPartsWithPath.length },
    '[OpenAIMultimodalMapper] Processing media parts',
  )

  for (const mediaPart of mediaPartsWithPath) {
    const attachment = await convertMediaToOpenAIBase64(mediaPart, payload, req)
    if (attachment) {
      attachments.push(attachment)
      logger.info(
        { mediaId: mediaPart.mediaId },
        '[OpenAIMultimodalMapper] Successfully converted media to OpenAI format',
      )
    } else {
      logger.warn(
        { mediaId: mediaPart.mediaId },
        '[OpenAIMultimodalMapper] Failed to convert media - returned null',
      )
    }
  }

  logger.info(
    { inputCount: mediaPartsWithPath.length, outputCount: attachments.length },
    '[OpenAIMultimodalMapper] Finished processing',
  )

  return attachments
}

/**
 * Convert a single media part to OpenAI base64 format
 */
async function convertMediaToOpenAIBase64(
  mediaPart: MediaPartWithPath,
  payload: Payload,
  req?: { headers: { authorization?: string; cookie?: string } },
): Promise<{ data: string; mimeType: string } | null> {
  const { absoluteFilePath, publicUrl, mimeType, mediaId } = mediaPart

  logger.info({ mediaId, absoluteFilePath, mimeType }, '[OpenAIMultimodalMapper] Reading file')

  try {
    let fileBuffer: Buffer

    // Try filesystem first (local dev)
    try {
      const fs = await import('fs/promises')
      fileBuffer = await fs.readFile(absoluteFilePath)
      logger.info(
        { mediaId, fileSize: fileBuffer.length, method: 'fs' },
        '[OpenAIMultimodalMapper] File read via filesystem',
      )
    } catch (_fsError) {
      // Filesystem failed (serverless), use Payload Local API
      logger.info(
        { mediaId, publicUrl },
        '[OpenAIMultimodalMapper] Filesystem failed, using Payload Local API',
      )

      // Fetch media document to get file data
      const mediaDoc = await payload.findByID({
        collection: 'media',
        id: mediaId,
        depth: 0,
        overrideAccess: true, // Bypass access control for internal operations
      })

      if (!mediaDoc || !mediaDoc.url) {
        throw new Error('Media document has no file URL')
      }

      // Normalize URL to handle local/relative URLs (fixes ECONNREFUSED errors)
      let fetchUrl = mediaDoc.url
      if (!isVercelBlobUrl(mediaDoc.url)) {
        fetchUrl = await normalizeToAbsoluteUrl(mediaDoc.url)
        logger.info(
          { mediaId, originalUrl: mediaDoc.url, normalizedUrl: fetchUrl },
          '[OpenAIMultimodalMapper] Normalized URL for fetch',
        )
      }

      // Fetch the file using the URL with authentication headers
      const headers: Record<string, string> = {}
      if (req?.headers.authorization) {
        headers['Authorization'] = req.headers.authorization
      }
      if (req?.headers.cookie) {
        headers['Cookie'] = req.headers.cookie
      }

      logger.info(
        { mediaId, fetchUrl, hasAuth: !!req?.headers.authorization },
        '[OpenAIMultimodalMapper] Fetching file with auth headers',
      )

      const response = await fetch(fetchUrl, { headers })
      if (!response.ok) {
        throw new Error(`HTTP fetch failed: ${response.status} ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      fileBuffer = Buffer.from(arrayBuffer)
      logger.info(
        { mediaId, fileSize: fileBuffer.length, method: 'payload-api' },
        '[OpenAIMultimodalMapper] File fetched via Payload API',
      )
    }

    const base64 = fileBuffer.toString('base64')
    logger.info(
      { mediaId, fileSize: fileBuffer.length, base64Length: base64.length },
      '[OpenAIMultimodalMapper] File read successfully',
    )

    return { data: base64, mimeType }
  } catch (error) {
    logger.error(
      { err: error, mediaId, absoluteFilePath, publicUrl },
      '[OpenAIMultimodalMapper] Failed to read media file',
    )
    return null
  }
}

/**
 * Check if a media type is supported by OpenAI multimodal
 */
export function isOpenAIMediaTypeSupported(type: 'image' | 'pdf'): boolean {
  // OpenAI supports images, PDF support varies by provider
  if (type === 'pdf') {
    logger.warn('[OpenAIMultimodalMapper] PDF support depends on OpenAI-compatible provider')
    return false // Default to false for safety
  }
  return type === 'image'
}
