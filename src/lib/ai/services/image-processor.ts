/**
 * Image optimization utilities for AI processing
 * Reusable across all AI features that accept images
 */
import sharp from 'sharp'

export interface OptimizedImage {
  buffer: Buffer
  width: number
  height: number
  sizeBytes: number
  wasResized: boolean
}

/**
 * Optimize an image for AI processing
 * - Resizes large images to reduce API latency and costs
 * - Maintains aspect ratio
 * - Returns metadata for logging
 */
export async function optimizeImageForAI(
  imageBuffer: Buffer,
  maxDimension = 2048,
): Promise<OptimizedImage> {
  const metadata = await sharp(imageBuffer).metadata()
  const originalSize = { width: metadata.width!, height: metadata.height! }

  const needsResize = Math.max(originalSize.width, originalSize.height) > maxDimension

  const optimizedBuffer = needsResize
    ? await sharp(imageBuffer)
        .resize(maxDimension, maxDimension, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .toBuffer()
    : imageBuffer

  const finalMetadata = await sharp(optimizedBuffer).metadata()

  return {
    buffer: optimizedBuffer,
    width: finalMetadata.width!,
    height: finalMetadata.height!,
    sizeBytes: optimizedBuffer.length,
    wasResized: needsResize,
  }
}
