/**
 * Chat Asset Processing
 * Validates chat-asset attachments and converts them to MediaPartWithPath for AI consumption
 */

import type { Payload } from 'payload'
import type { Logger } from 'pino'

import type { MediaPartWithPath } from '@/infra/llm/multimodal'

export interface ChatAssetProcessingResult {
  success: boolean
  mediaPartsWithPath: MediaPartWithPath[]
  error?: string
}

export async function processChatAssetAttachments(
  payload: Payload,
  chatAssetIds: string[],
  userId: string,
  reqLogger: Logger,
): Promise<ChatAssetProcessingResult> {
  if (!chatAssetIds || chatAssetIds.length === 0) {
    return { success: true, mediaPartsWithPath: [] }
  }

  reqLogger.info({ chatAssetIds, userId }, 'Processing chat-asset attachments')

  try {
    const { docs: chatAssets } = await payload.find({
      collection: 'chat-assets',
      where: {
        and: [{ id: { in: chatAssetIds } }, { createdBy: { equals: userId } }],
      },
      limit: chatAssetIds.length,
      overrideAccess: true,
    })

    if (chatAssets.length !== chatAssetIds.length) {
      const foundIds = chatAssets.map((a) => a.id)
      const missingIds = chatAssetIds.filter((id) => !foundIds.includes(id))
      reqLogger.warn({ missingIds }, 'Some chat-asset IDs not found or not owned by user')
    }

    const now = new Date()
    const validAssets = chatAssets.filter((asset) => {
      const expiresAt = asset.expiresAt ? new Date(asset.expiresAt) : null
      if (expiresAt && expiresAt < now) {
        reqLogger.warn({ assetId: asset.id }, 'Chat asset has expired')
        return false
      }
      return true
    })

    if (validAssets.length === 0 && chatAssetIds.length > 0) {
      return {
        success: false,
        mediaPartsWithPath: [],
        error: 'No valid chat assets found',
      }
    }

    const mediaPartsWithPath: MediaPartWithPath[] = validAssets.map((asset) => {
      const mimeType = asset.mimeType || ''
      const isPdf = mimeType === 'application/pdf'
      const type = isPdf ? 'pdf' : 'image'

      return {
        mediaId: asset.id,
        type,
        absoluteFilePath: '',
        publicUrl: asset.url,
        mimeType,
      }
    })

    reqLogger.info({ validAssetCount: validAssets.length }, 'Chat-asset validation passed')

    return {
      success: true,
      mediaPartsWithPath,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    reqLogger.error({ error: errorMessage }, 'Failed to process chat assets')
    return {
      success: false,
      mediaPartsWithPath: [],
      error: errorMessage,
    }
  }
}
