/**
 * V2 Image Strip Extraction & Stitching Service
 *
 * Extracts horizontal strips from rendered PDF pages and vertically
 * stitches strips for exercises that span across pages.
 *
 * @fileType service
 * @domain conversion
 * @pattern image-processing
 */

import type { PageImage } from './pdf-render-service'

/**
 * Extract a horizontal strip from a page image using normalized Y coordinates.
 *
 * @param page - Rendered page image
 * @param yStartNorm - Start Y in normalized 0-1 coordinates
 * @param yEndNorm - End Y in normalized 0-1 coordinates
 * @returns Cropped strip as PNG buffer
 */
export async function extractStrip(
  page: PageImage,
  yStartNorm: number,
  yEndNorm: number,
): Promise<Buffer> {
  const sharp = (await import('sharp')).default

  const top = Math.round(Math.max(0, yStartNorm) * page.height)
  const bottom = Math.round(Math.min(1, yEndNorm) * page.height)
  const height = Math.max(1, bottom - top)

  return sharp(page.buffer)
    .extract({
      left: 0,
      top,
      width: page.width,
      height: Math.min(height, page.height - top),
    })
    .png()
    .toBuffer()
}

/**
 * Vertically stitch two image buffers into a single image.
 * Places topBuffer above bottomBuffer on a white canvas.
 * Handles strips with different widths by using the max and resizing the narrower one.
 *
 * @param topBuffer - PNG buffer for the top portion
 * @param bottomBuffer - PNG buffer for the bottom portion
 * @param _width - Hint width (actual widths are read from image metadata)
 * @returns Combined PNG buffer
 */
export async function stitchVertical(
  topBuffer: Buffer,
  bottomBuffer: Buffer,
  _width?: number,
): Promise<Buffer> {
  const sharp = (await import('sharp')).default

  const topMeta = await sharp(topBuffer).metadata()
  const bottomMeta = await sharp(bottomBuffer).metadata()

  const topWidth = topMeta.width ?? 0
  const topHeight = topMeta.height ?? 0
  const bottomWidth = bottomMeta.width ?? 0
  const bottomHeight = bottomMeta.height ?? 0

  const canvasWidth = Math.max(topWidth, bottomWidth)

  // Resize strips to match canvas width if they differ
  const resizedTop =
    topWidth < canvasWidth
      ? await sharp(topBuffer).resize({ width: canvasWidth }).png().toBuffer()
      : topBuffer

  const resizedBottom =
    bottomWidth < canvasWidth
      ? await sharp(bottomBuffer).resize({ width: canvasWidth }).png().toBuffer()
      : bottomBuffer

  // Re-read heights after potential resize
  const finalTopHeight =
    topWidth < canvasWidth ? ((await sharp(resizedTop).metadata()).height ?? topHeight) : topHeight
  const finalBottomHeight =
    bottomWidth < canvasWidth
      ? ((await sharp(resizedBottom).metadata()).height ?? bottomHeight)
      : bottomHeight

  return sharp({
    create: {
      width: canvasWidth,
      height: finalTopHeight + finalBottomHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      { input: resizedTop, top: 0, left: 0 },
      { input: resizedBottom, top: finalTopHeight, left: 0 },
    ])
    .png()
    .toBuffer()
}
