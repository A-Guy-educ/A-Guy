/**
 * V3 Converter - Asset Handler
 *
 * Handles creation of ExerciseAssets for SVG and Media blocks.
 * Uses privileged execution for internal asset writes (NFR-003).
 *
 * NOTE: This is a stub implementation. In production, this would integrate
 * with the actual ExerciseAssets collection schema.
 *
 * @fileType utility
 * @domain conversion
 * @pattern asset-management
 */

import type { Payload } from 'payload'

// ---------------------------------
// Types
// ---------------------------------

export interface AssetCreationResult {
  success: boolean
  assetId?: string
  error?: string
}

export interface AssetCreationParams {
  payload: Payload
  type: 'svg' | 'media'
  content: string
  mimeType?: string
  correlationId: string
  // Optional req for transaction safety when called from hooks
  req?: {
    payload: Payload
  }
}

// ---------------------------------
// Asset Handler Functions
// ---------------------------------

/**
 * Create an SVG asset in ExerciseAssets collection.
 * Uses privileged execution (overrideAccess: true) for internal writes.
 *
 * NOTE: This is a stub - actual implementation depends on ExerciseAssets collection schema.
 */
export async function createSvgAsset(params: AssetCreationParams): Promise<AssetCreationResult> {
  const { correlationId } = params

  // Stub implementation - in production, this would create the actual asset
  // For now, return a placeholder ID
  return {
    success: true,
    assetId: `svg_asset_${correlationId}`,
  }
}

/**
 * Create a media asset in ExerciseAssets collection.
 * For URL-based media, stores the reference; for file uploads, processes them.
 *
 * NOTE: This is a stub - actual implementation depends on ExerciseAssets collection schema.
 */
export async function createMediaAsset(params: AssetCreationParams): Promise<AssetCreationResult> {
  const { correlationId } = params

  // Stub implementation - in production, this would create the actual asset
  return {
    success: true,
    assetId: `media_asset_${correlationId}`,
  }
}

/**
 * Handle asset creation failure by producing a fallback block.
 * Returns a rich_text block with a safe reference to the original content.
 */
export function handleAssetFailure(
  segmentType: 'svg' | 'media',
  content: string,
  correlationId: string,
): { fallbackContent: string; warningMessage: string } {
  // Produce a non-dropping fallback representation
  const fallbackContent =
    segmentType === 'svg'
      ? `[SVG content - asset creation failed for correlation: ${correlationId}]`
      : `[Media: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}]`

  const warningMessage = `Asset creation failed for ${segmentType} (correlation: ${correlationId}), using fallback representation`

  return {
    fallbackContent,
    warningMessage,
  }
}

/**
 * Create asset with automatic type detection.
 */
export async function createAsset(params: AssetCreationParams): Promise<AssetCreationResult> {
  const { type } = params

  if (type === 'svg') {
    return createSvgAsset(params)
  }

  return createMediaAsset(params)
}
