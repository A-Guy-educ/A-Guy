/**
 * V2 Image Cropping Service
 *
 * Crops exercise images from full PDF pages using bounding boxes.
 * Uses sharp for high-quality image processing.
 *
 * @fileType service
 * @domain ai
 * @pattern image-processing, cropping
 */

/**
 * Normalized bounding box (0-1 scale)
 */
export interface NormalizedBbox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Crop configuration options
 */
export interface CropOptions {
  /** Minimum crop width in pixels (default: 20) */
  minWidth?: number
  /** Minimum crop height in pixels (default: 20) */
  minHeight?: number
  /** Padding around the crop in pixels (default: 0) */
  padding?: number
  /** Output format (default: 'png') */
  format?: 'png' | 'jpeg' | 'webp'
  /** Output quality for lossy formats (default: 90) */
  quality?: number
}

/**
 * Result of image cropping operation
 */
export interface CropResult {
  buffer: Buffer
  width: number
  height: number
}

/**
 * Default crop options
 */
const DEFAULT_CROP_OPTIONS: Required<CropOptions> = {
  minWidth: 20,
  minHeight: 20,
  padding: 0,
  format: 'png',
  quality: 90,
}

/**
 * Crop an exercise image from a full-page image using normalized bounding box.
 *
 * @param pageImageBuffer - Full page PNG buffer
 * @param pageWidth - Width of the full page image in pixels
 * @param pageHeight - Height of the full page image in pixels
 * @param bbox - Normalized bounding box (0-1 scale)
 * @param options - Crop configuration options
 * @returns Cropped image buffer
 * @throws Error if crop fails or is too small
 */
export async function cropExerciseImage(
  pageImageBuffer: Buffer,
  pageWidth: number,
  pageHeight: number,
  bbox: NormalizedBbox,
  options: CropOptions = {},
): Promise<Buffer> {
  const opts = { ...DEFAULT_CROP_OPTIONS, ...options }

  // Validate bbox coordinates are in valid range
  if (bbox.x < 0 || bbox.y < 0 || bbox.width <= 0 || bbox.height <= 0) {
    throw new Error(
      `Invalid bbox coordinates: x=${bbox.x}, y=${bbox.y}, width=${bbox.width}, height=${bbox.height}. Values must be positive.`,
    )
  }

  // Clamp bbox to 0-1 range with boundary handling
  const clampedX = Math.max(0, Math.min(1, bbox.x))
  const clampedY = Math.max(0, Math.min(1, bbox.y))
  const clampedWidth = Math.max(0, Math.min(1 - clampedX, bbox.width))
  const clampedHeight = Math.max(0, Math.min(1 - clampedY, bbox.height))

  // Calculate pixel coordinates
  let cropX = Math.round(clampedX * pageWidth)
  let cropY = Math.round(clampedY * pageHeight)
  let cropWidth = Math.round(clampedWidth * pageWidth)
  let cropHeight = Math.round(clampedHeight * pageHeight)

  // Apply padding if specified
  if (opts.padding > 0) {
    cropX = Math.max(0, cropX - opts.padding)
    cropY = Math.max(0, cropY - opts.padding)
    cropWidth = Math.min(Math.floor(pageWidth) - cropX, cropWidth + opts.padding * 2)
    cropHeight = Math.min(Math.floor(pageHeight) - cropY, cropHeight + opts.padding * 2)
  }

  // Validate minimum size
  if (cropWidth < opts.minWidth) {
    throw new Error(
      `Crop width (${cropWidth}px) is below minimum threshold (${opts.minWidth}px). Bbox: ${JSON.stringify(bbox)}`,
    )
  }

  if (cropHeight < opts.minHeight) {
    throw new Error(
      `Crop height (${cropHeight}px) is below minimum threshold (${opts.minHeight}px). Bbox: ${JSON.stringify(bbox)}`,
    )
  }

  // Ensure crop stays within image bounds and all values are integers (sharp requires ints)
  const imgW = Math.floor(pageWidth)
  const imgH = Math.floor(pageHeight)
  cropX = Math.min(cropX, imgW - 1)
  cropY = Math.min(cropY, imgH - 1)
  cropWidth = Math.min(cropWidth, imgW - cropX)
  cropHeight = Math.min(cropHeight, imgH - cropY)

  // Perform crop using sharp
  const sharp = (await import('sharp')).default

  const croppedBuffer = await sharp(pageImageBuffer)
    .extract({
      left: Math.round(cropX),
      top: Math.round(cropY),
      width: Math.round(cropWidth),
      height: Math.round(cropHeight),
    })
    .toFormat(opts.format, { quality: opts.quality })
    .toBuffer()

  return croppedBuffer
}

/**
 * Validate a bounding box without performing the crop.
 * Useful for pre-validation before crop operation.
 *
 * @param bbox - Normalized bounding box to validate
 * @param pageWidth - Page width in pixels
 * @param pageHeight - Page height in pixels
 * @param minWidth - Minimum width threshold in pixels
 * @param minHeight - Minimum height threshold in pixels
 * @returns Validation result with isValid flag and error message if invalid
 */
export function validateBbox(
  bbox: NormalizedBbox,
  pageWidth: number,
  pageHeight: number,
  minWidth = DEFAULT_CROP_OPTIONS.minWidth,
  minHeight = DEFAULT_CROP_OPTIONS.minHeight,
): { isValid: boolean; error?: string } {
  // Check for invalid coordinates
  if (bbox.x < 0 || bbox.y < 0 || bbox.width <= 0 || bbox.height <= 0) {
    return { isValid: false, error: 'Bounding box has invalid coordinates' }
  }

  // Check bounds
  if (bbox.x + bbox.width > 1 || bbox.y + bbox.height > 1) {
    return { isValid: false, error: 'Bounding box exceeds image boundaries' }
  }

  // Calculate pixel dimensions
  const pixelWidth = Math.round(bbox.width * pageWidth)
  const pixelHeight = Math.round(bbox.height * pageHeight)

  // Check minimum size
  if (pixelWidth < minWidth) {
    return { isValid: false, error: `Width (${pixelWidth}px) below minimum (${minWidth}px)` }
  }

  if (pixelHeight < minHeight) {
    return { isValid: false, error: `Height (${pixelHeight}px) below minimum (${minHeight}px)` }
  }

  return { isValid: true }
}

/**
 * Convert pixel coordinates to normalized coordinates.
 *
 * @param x - Pixel x coordinate
 * @param y - Pixel y coordinate
 * @param width - Pixel width
 * @param height - Pixel height
 * @param pageWidth - Page width in pixels
 * @param pageHeight - Page height in pixels
 * @returns Normalized bounding box
 */
export function pixelsToNormalized(
  x: number,
  y: number,
  width: number,
  height: number,
  pageWidth: number,
  pageHeight: number,
): NormalizedBbox {
  return {
    x: Math.max(0, Math.min(1, x / pageWidth)),
    y: Math.max(0, Math.min(1, y / pageHeight)),
    width: Math.max(0, Math.min(1, width / pageWidth)),
    height: Math.max(0, Math.min(1, height / pageHeight)),
  }
}

/**
 * Convert normalized coordinates to pixel coordinates.
 *
 * @param bbox - Normalized bounding box
 * @param pageWidth - Page width in pixels
 * @param pageHeight - Page height in pixels
 * @returns Pixel bounding box with rounded values
 */
export function normalizedToPixels(
  bbox: NormalizedBbox,
  pageWidth: number,
  pageHeight: number,
): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.round(bbox.x * pageWidth),
    y: Math.round(bbox.y * pageHeight),
    width: Math.round(bbox.width * pageWidth),
    height: Math.round(bbox.height * pageHeight),
  }
}
