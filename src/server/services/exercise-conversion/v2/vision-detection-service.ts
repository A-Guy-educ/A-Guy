/**
 * V2 Vision Bounding Box Detection Service
 *
 * Detects exercise bounding boxes in PDF pages using Vision LLM.
 * Renders PDF pages to images, sends to LLM, and parses bounding box responses.
 *
 * @fileType service
 * @domain ai
 * @pattern vision-detection, pdf-processing
 */

import type { Payload } from 'payload'
import {
  getLLMProvider,
  getProviderModelConfig,
  getProviderTypeFromEnv,
} from '@/infra/llm/providers/factory'

/**
 * Detected exercise bounding box from Vision LLM
 */
export interface DetectedExercise {
  bbox: {
    x: number
    y: number
    width: number
    height: number
  }
  label?: string
  confidence?: number
}

/**
 * Result of bounding box detection for a page
 */
export interface BboxDetectionResult {
  detections: DetectedExercise[]
  pageImageBuffer: Buffer
  pageWidth: number
  pageHeight: number
}

/**
 * Hardcoded vision prompt for exercise detection
 */
const VISION_DETECTION_PROMPT = `Analyze this PDF page image and identify all individual exercises.

For each exercise, provide a bounding box in normalized coordinates (0-1 scale) where:
- x, y: top-left corner
- width, height: dimensions

Return ONLY a JSON array with this schema:
[
  {
    "bbox": { "x": 0.1, "y": 0.2, "width": 0.3, "height": 0.15 },
    "label": "1"  // optional exercise number/label if visible
  }
]

Rules:
- Each exercise = one bounding box (no merging across pages)
- Include only visible exercises, not page headers/footers
- Return empty array [] if no exercises found
- Coordinates must be normalized 0-1
- Do not include any markdown formatting, just raw JSON
`

/**
 * Detect exercise bounding boxes in a PDF page using Vision LLM.
 *
 * @param pdfBuffer - The full PDF file buffer
 * @param pageIndex - 0-based page index to process
 * @param payload - Payload instance for LLM provider access
 * @returns Detection result with bounding boxes and rendered page image
 */
export async function detectExerciseBboxes(
  pdfBuffer: Buffer,
  pageIndex: number,
  payload: Payload,
): Promise<BboxDetectionResult> {
  // Render PDF page to image
  const pageImageResult = await renderPdfPageToImage(pdfBuffer, pageIndex)

  // Call Vision LLM for bounding box detection
  const detections = await detectBboxesWithVision(pageImageResult.pageImageBuffer, payload)

  return {
    detections,
    pageImageBuffer: pageImageResult.pageImageBuffer,
    pageWidth: pageImageResult.pageWidth,
    pageHeight: pageImageResult.pageHeight,
  }
}

/**
 * Render a single PDF page to a PNG image buffer using pdfjs-dist and canvas.
 */
async function renderPdfPageToImage(
  pdfBuffer: Buffer,
  pageIndex: number,
): Promise<{ pageImageBuffer: Buffer; pageWidth: number; pageHeight: number }> {
  // Dynamic imports for pdfjs-dist
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { createCanvas } = await import('@napi-rs/canvas')

  // Load PDF document
  const loadingTask = pdfjsLib.getDocument({
    data: pdfBuffer,
    useSystemFonts: true,
    enableXfa: false,
  })

  const pdf = await loadingTask.promise

  // Get the specific page (0-indexed)
  const page = await pdf.getPage(pageIndex + 1) // pdfjs-dist uses 1-based indexing

  // Get page dimensions with 2x scale for better quality
  const viewport = page.getViewport({ scale: 2.0 })
  const { width, height } = viewport

  // Create canvas and render page
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D

  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  // White background for proper image handling
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)

  // Render page to canvas
  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise

  // Convert to PNG buffer using @napi-rs/canvas encode method
  const pageImageBuffer = Buffer.from(await canvas.encode('png'))

  return { pageImageBuffer, pageWidth: width, pageHeight: height }
}

/**
 * Send page image to Vision LLM and parse bounding box response.
 */
async function detectBboxesWithVision(
  pageImageBuffer: Buffer,
  payload: Payload,
): Promise<DetectedExercise[]> {
  // Get LLM provider
  const provider = await getLLMProvider(payload)
  const providerType = await getProviderTypeFromEnv(payload)
  const modelConfig = getProviderModelConfig(providerType, 'PDF_TO_EXERCISE')

  // Convert image to base64
  const base64Image = pageImageBuffer.toString('base64')

  // Call LLM with image attachment
  const result = await provider.generateMultimodalCompletion(
    {
      prompt: VISION_DETECTION_PROMPT,
      model: modelConfig,
      attachments: [
        {
          data: base64Image,
          mimeType: 'image/png',
        },
      ],
    },
    payload,
  )

  // Parse response
  return parseBboxResponse(result.text)
}

/**
 * Parse LLM response into structured bounding boxes.
 * Handles various response formats and validates coordinates.
 */
function parseBboxResponse(response: string): DetectedExercise[] {
  try {
    // Clean response - remove markdown code blocks if present
    const cleanedResponse = response
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()

    const parsed = JSON.parse(cleanedResponse)

    if (!Array.isArray(parsed)) {
      console.warn('[V2 Vision] Response is not an array, returning empty')
      return []
    }

    // Validate and normalize each detection
    const validDetections: DetectedExercise[] = []

    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i]

      if (!item.bbox || typeof item.bbox !== 'object') {
        console.warn(`[V2 Vision] Item ${i} missing valid bbox, skipping`)
        continue
      }

      const bbox = item.bbox

      // Validate bbox has required properties and values are in valid range
      if (
        typeof bbox.x !== 'number' ||
        typeof bbox.y !== 'number' ||
        typeof bbox.width !== 'number' ||
        typeof bbox.height !== 'number'
      ) {
        console.warn(`[V2 Vision] Item ${i} has invalid bbox values, skipping`)
        continue
      }

      // Clamp values to 0-1 range
      const normalizedBbox = {
        x: Math.max(0, Math.min(1, bbox.x)),
        y: Math.max(0, Math.min(1, bbox.y)),
        width: Math.max(0, Math.min(1, bbox.width)),
        height: Math.max(0, Math.min(1, bbox.height)),
      }

      // Skip zero-area boxes
      if (normalizedBbox.width === 0 || normalizedBbox.height === 0) {
        console.warn(`[V2 Vision] Item ${i} has zero area, skipping`)
        continue
      }

      validDetections.push({
        bbox: normalizedBbox,
        label: typeof item.label === 'string' ? item.label : undefined,
        confidence: typeof item.confidence === 'number' ? item.confidence : undefined,
      })
    }

    // Sort by vertical position (top to bottom)
    validDetections.sort((a, b) => a.bbox.y - b.bbox.y)

    return validDetections
  } catch (error) {
    console.error('[V2 Vision] Failed to parse response:', error)
    console.debug('[V2 Vision] Raw response:', response)
    return []
  }
}
