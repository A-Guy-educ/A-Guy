/**
 * Gemini Multimodal Mapper
 * Uses resolved paths from validation (no extra DB queries)
 */
import type { Part } from '@google/generative-ai'
import fs from 'fs/promises'

import { isVercelBlobUrl } from '@/infra/blob/vercel-blob-adapter'
import type { MediaPartWithPath } from '@/infra/llm/multimodal/types'
import { logger } from '@/infra/utils/logger'
import { normalizeToAbsoluteUrl } from '@/server/services/pdf-fetcher'
import type { Payload } from 'payload'

/**
 * Convert validated media parts to Gemini format
 * Returns parts array ready to be included in Gemini content
 */
export async function mapMultimodalToGemini(
  mediaPartsWithPath: MediaPartWithPath[],
  payload: Payload,
  req?: { headers: { authorization?: string; cookie?: string } },
): Promise<{ currentMessage: Part[] }> {
  const currentParts: Part[] = []

  logger.info(
    { mediaCount: mediaPartsWithPath.length, mediaParts: mediaPartsWithPath },
    '[MultimodalMapper] Processing media parts',
  )

  for (const mediaPart of mediaPartsWithPath) {
    const geminiPart = await convertMediaToGeminiPart(mediaPart, payload, req)
    if (geminiPart) {
      currentParts.push(geminiPart)
      logger.info(
        { mediaId: mediaPart.mediaId },
        '[MultimodalMapper] Successfully converted media to Gemini part',
      )
    } else {
      logger.warn(
        { mediaId: mediaPart.mediaId },
        '[MultimodalMapper] Failed to convert media - returned null',
      )
    }
  }

  logger.info(
    { inputCount: mediaPartsWithPath.length, outputCount: currentParts.length },
    '[MultimodalMapper] Finished processing',
  )

  return { currentMessage: currentParts }
}

/**
 * Convert a single media part to Gemini inline data format
 * Uses Payload Local API for serverless compatibility
 */
async function convertMediaToGeminiPart(
  mediaPart: MediaPartWithPath,
  payload: Payload,
  req?: { headers: { authorization?: string; cookie?: string } },
): Promise<Part | null> {
  const { absoluteFilePath, publicUrl, mimeType, mediaId } = mediaPart

  logger.info({ mediaId, absoluteFilePath, mimeType }, '[MultimodalMapper] Reading file for Gemini')

  try {
    let fileBuffer: Buffer

    // Try filesystem first (local dev)
    try {
      fileBuffer = await fs.readFile(absoluteFilePath)
      logger.info(
        { mediaId, fileSize: fileBuffer.length, method: 'fs' },
        '[MultimodalMapper] File read via filesystem',
      )
    } catch (_fsError) {
      // Filesystem failed (serverless), use Payload Local API
      logger.info(
        { mediaId, publicUrl },
        '[MultimodalMapper] Filesystem failed, using Payload Local API',
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
          '[MultimodalMapper] Normalized URL for fetch',
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
        '[MultimodalMapper] Fetching file with auth headers',
      )

      const response = await fetch(fetchUrl, { headers })
      if (!response.ok) {
        throw new Error(`HTTP fetch failed: ${response.status} ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      fileBuffer = Buffer.from(arrayBuffer)
      logger.info(
        { mediaId, fileSize: fileBuffer.length, method: 'payload-api' },
        '[MultimodalMapper] File fetched via Payload API',
      )
    }

    const base64 = fileBuffer.toString('base64')
    logger.info(
      { mediaId, fileSize: fileBuffer.length, base64Length: base64.length },
      '[MultimodalMapper] File read successfully',
    )

    return {
      inlineData: {
        data: base64,
        mimeType,
      },
    }
  } catch (error) {
    logger.error(
      { err: error, mediaId, absoluteFilePath, publicUrl },
      '[MultimodalMapper] Failed to read media file for Gemini',
    )
    return null
  }
}

/**
 * Check if a media type is supported by Gemini multimodal
 */
export function isMediaTypeSupported(type: 'image' | 'pdf'): boolean {
  return ['image', 'pdf'].includes(type)
}
