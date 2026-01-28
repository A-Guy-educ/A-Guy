/**
 * Chat Media Processing
 * Handles validation and processing of media attachments
 */
import type { Payload, PayloadRequest } from 'payload'
import type { Logger } from 'pino'

import {
  setEphemeralRetention,
  validateChatMedia,
  type MediaPartWithPath,
} from '@/infra/llm/multimodal'

export interface MediaProcessingResult {
  success: boolean
  mediaPartsWithPath: MediaPartWithPath[]
  error?: string
  errorDetails?: string
}

/**
 * Process and validate media attachments
 * Returns validated media parts or error
 */
export async function processMediaAttachments(
  payload: Payload,
  mediaIds: string[],
  userId: string,
  req: PayloadRequest,
  reqLogger: Logger,
): Promise<MediaProcessingResult> {
  if (!mediaIds || mediaIds.length === 0) {
    return { success: true, mediaPartsWithPath: [] }
  }

  reqLogger.info({ mediaIds, userId }, 'Processing media attachments')

  const validationResult = await validateChatMedia(payload, mediaIds, userId)
  reqLogger.info(
    { valid: validationResult.valid, mediaItems: validationResult.mediaItems },
    'Media validation result',
  )

  // Full validation success required
  if (!validationResult.valid) {
    const errors = validationResult.mediaItems
      .filter((m) => m.error)
      .map((m) => `${m.mediaId}: ${m.error}`)
      .join(', ')

    return {
      success: false,
      mediaPartsWithPath: [],
      error: 'Invalid media attachments',
      errorDetails: errors,
    }
  }

  if (validationResult.hasUnsupportedMedia) {
    return {
      success: false,
      mediaPartsWithPath: [],
      error: 'Some media types are not supported by the AI model',
    }
  }

  // Set ephemeral retention using validated parts (tenant-safe)
  await setEphemeralRetention(payload, validationResult.mediaPartsWithPath, req)

  reqLogger.info(
    { validMediaCount: validationResult.mediaPartsWithPath.length },
    'Media validation passed, retention set to ephemeral',
  )

  return {
    success: true,
    mediaPartsWithPath: validationResult.mediaPartsWithPath,
  }
}
