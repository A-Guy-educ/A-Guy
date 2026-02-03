/**
 * Media Reader Utility
 * Common file reading logic for multimodal mappers
 *
 * @fileType utility
 * @domain ai
 * @pattern data-transformation
 */
import type { Payload } from 'payload'

import { isVercelBlobUrl } from '@/infra/blob/vercel-blob-adapter'
import type { MediaPartWithPath } from '@/infra/llm/multimodal/types'
import { logger } from '@/infra/utils/logger'
import { normalizeToAbsoluteUrl } from '@/server/services/pdf-fetcher'

export interface MediaReaderOptions {
  /** Provider name for logging */
  providerName: string
  /** Function to convert buffer to provider-specific format */
  convertBuffer: (buffer: Buffer, mimeType: string) => Promise<unknown> | unknown
}

/**
 * Read a single media file and convert it to the provider-specific format
 */
export async function readMediaFile(
  mediaPart: MediaPartWithPath,
  payload: Payload,
  options: MediaReaderOptions,
  req?: { headers: { authorization?: string; cookie?: string } },
): Promise<unknown | null> {
  const { absoluteFilePath, publicUrl, mimeType, mediaId } = mediaPart
  const { providerName, convertBuffer } = options

  logger.info({ mediaId, absoluteFilePath, mimeType }, `[${providerName}MediaReader] Reading file`)

  try {
    let fileBuffer: Buffer

    // Try filesystem first (local dev)
    try {
      const fs = await import('fs/promises')
      fileBuffer = await fs.readFile(absoluteFilePath)
      logger.info(
        { mediaId, fileSize: fileBuffer.length, method: 'fs' },
        `[${providerName}MediaReader] File read via filesystem`,
      )
    } catch (_fsError) {
      // Filesystem failed (serverless), use Payload Local API
      logger.info(
        { mediaId, publicUrl },
        `[${providerName}MediaReader] Filesystem failed, using Payload Local API`,
      )

      const mediaDoc = await payload.findByID({
        collection: 'media',
        id: mediaId,
        depth: 0,
        overrideAccess: true,
      })

      if (!mediaDoc || !mediaDoc.url) {
        throw new Error('Media document has no file URL')
      }

      let fetchUrl = mediaDoc.url
      if (!isVercelBlobUrl(mediaDoc.url)) {
        fetchUrl = await normalizeToAbsoluteUrl(mediaDoc.url)
        logger.info(
          { mediaId, originalUrl: mediaDoc.url, normalizedUrl: fetchUrl },
          `[${providerName}MediaReader] Normalized URL for fetch`,
        )
      }

      const headers: Record<string, string> = {}
      if (req?.headers.authorization) {
        headers['Authorization'] = req.headers.authorization
      }
      if (req?.headers.cookie) {
        headers['Cookie'] = req.headers.cookie
      }

      logger.info(
        { mediaId, fetchUrl, hasAuth: !!req?.headers.authorization },
        `[${providerName}MediaReader] Fetching file with auth headers`,
      )

      const response = await fetch(fetchUrl, { headers })
      if (!response.ok) {
        throw new Error(`HTTP fetch failed: ${response.status} ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      fileBuffer = Buffer.from(arrayBuffer)
      logger.info(
        { mediaId, fileSize: fileBuffer.length, method: 'payload-api' },
        `[${providerName}MediaReader] File fetched via Payload API`,
      )
    }

    logger.info(
      { mediaId, fileSize: fileBuffer.length },
      `[${providerName}MediaReader] File read successfully`,
    )

    return await convertBuffer(fileBuffer, mimeType)
  } catch (error) {
    logger.error(
      { err: error, mediaId, absoluteFilePath, publicUrl },
      `[${providerName}MediaReader] Failed to read media file`,
    )
    return null
  }
}

/**
 * Process multiple media parts and return converted media
 */
export async function readMediaParts(
  mediaPartsWithPath: MediaPartWithPath[],
  payload: Payload,
  options: MediaReaderOptions,
  req?: { headers: { authorization?: string; cookie?: string } },
): Promise<unknown[]> {
  const convertedMedia: unknown[] = []

  logger.info(
    { mediaCount: mediaPartsWithPath.length },
    `[${options.providerName}MediaReader] Processing media parts`,
  )

  for (const mediaPart of mediaPartsWithPath) {
    const converted = await readMediaFile(mediaPart, payload, options, req)
    if (converted) {
      convertedMedia.push(converted)
      logger.info(
        { mediaId: mediaPart.mediaId },
        `[${options.providerName}MediaReader] Successfully converted media`,
      )
    } else {
      logger.warn(
        { mediaId: mediaPart.mediaId },
        `[${options.providerName}MediaReader] Failed to convert media - returned null`,
      )
    }
  }

  logger.info(
    { inputCount: mediaPartsWithPath.length, outputCount: convertedMedia.length },
    `[${options.providerName}MediaReader] Finished processing`,
  )

  return convertedMedia
}
