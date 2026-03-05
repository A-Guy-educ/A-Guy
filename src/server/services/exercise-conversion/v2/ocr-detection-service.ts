/**
 * V2 OCR-based Exercise Detection Service
 *
 * Uses Tesseract.js to OCR scanned PDF page images, then pattern-matches
 * exercise labels from the recognized text lines with their bounding boxes.
 * Deterministic once OCR completes — no Vision LLM needed.
 *
 * @fileType service
 * @domain conversion
 * @pattern ocr, pattern-matching
 */

import type { ExerciseStart, PageDetectionResult } from './vision-detection-service'
import type { TextLine } from './text-detection-service'
import { logger } from '@/infra/utils/logger'

/**
 * Shared exercise label patterns — same patterns as text-detection-service.
 * Duplicated here to keep the module self-contained and avoid circular deps.
 *
 * Hebrew RTL text may arrive with the label at the end of the line.
 */
const EXERCISE_PATTERNS: {
  pattern: RegExp
  labelExtractor: (match: RegExpMatchArray) => string
}[] = [
  // Hebrew keyword patterns (can appear at start or end due to RTL)
  { pattern: /שאלה\s*(\d+)/, labelExtractor: (m) => m[1] },
  { pattern: /תרגיל\s*(\d+)/, labelExtractor: (m) => m[1] },
  // RTL end-of-line: Hebrew text followed by ". N" at the end
  { pattern: /[\u0590-\u05FF].*[.]\s*(\d+)\s*$/, labelExtractor: (m) => m[1] },
  // LTR start-of-line: "N." followed by Hebrew text
  { pattern: /^(\d+)\s*[.)]\s+[\u0590-\u05FF]/, labelExtractor: (m) => m[1] },
  // English patterns
  { pattern: /^Q(?:uestion)?\s*(\d+)/i, labelExtractor: (m) => m[1] },
  { pattern: /^Exercise\s*(\d+)/i, labelExtractor: (m) => m[1] },
  { pattern: /^Problem\s*(\d+)/i, labelExtractor: (m) => m[1] },
]

/** Y-coordinate tolerance for grouping OCR lines. */
const LINE_Y_TOLERANCE = 0.008

/**
 * Detect exercise start positions on a scanned page image using OCR.
 *
 * @param pageImageBuffer - PNG buffer of the rendered page
 * @param pageIndex - 0-based page index (for logging)
 * @param imageWidth - Page image width in pixels
 * @param imageHeight - Page image height in pixels
 * @returns Detection result compatible with the strip-based pipeline
 */
export async function detectExerciseStartsFromOCR(
  pageImageBuffer: Buffer,
  pageIndex: number,
  imageWidth: number,
  imageHeight: number,
): Promise<PageDetectionResult> {
  const lines = await ocrExtractLines(pageImageBuffer, imageWidth, imageHeight)

  logger.info({ pageIndex, lineCount: lines.length }, '[V2-OCR] OCR lines extracted')
  if (lines.length > 0 && lines.length <= 30) {
    for (const line of lines) {
      logger.debug({ pageIndex, y: line.y, text: line.text.substring(0, 80) }, '[V2-OCR] OCR line')
    }
  } else if (lines.length > 30) {
    for (const line of lines.slice(0, 10)) {
      logger.debug({ pageIndex, y: line.y, text: line.text.substring(0, 80) }, '[V2-OCR] OCR line')
    }
    logger.debug({ pageIndex, omittedCount: lines.length - 15 }, '[V2-OCR] Omitted lines')
    for (const line of lines.slice(-5)) {
      logger.debug({ pageIndex, y: line.y, text: line.text.substring(0, 80) }, '[V2-OCR] OCR line')
    }
  }

  if (lines.length === 0) {
    return {
      contentStartY: 0,
      contentEndY: 1,
      continuesFromPrevious: false,
      exercises: [],
    }
  }

  // Content region = first to last OCR line
  const contentStartY = lines[0].y
  const contentEndY = lines[lines.length - 1].yBottom

  // Find exercise labels
  const exercises: ExerciseStart[] = []
  for (const line of lines) {
    const match = matchExerciseLabel(line.text)
    if (match) {
      logger.debug(
        { pageIndex, label: match.label, y: line.y, text: line.text.substring(0, 60) },
        '[V2-OCR] Matched exercise',
      )
      exercises.push({
        label: match.label,
        startY: line.y,
      })
    }
  }

  // Sort by Y position (top to bottom)
  exercises.sort((a, b) => a.startY - b.startY)

  // Determine if page continues from previous exercise
  // Only true when exercises exist but the first one starts below content start.
  // Pages with NO exercises are NOT continuations.
  const continuesFromPrevious =
    exercises.length > 0 && exercises[0].startY - contentStartY > LINE_Y_TOLERANCE * 3

  return { contentStartY, contentEndY, continuesFromPrevious, exercises }
}

/**
 * OCR a page image and extract text lines with normalized bounding boxes.
 *
 * Uses Tesseract.js with Hebrew + English language data.
 * Returns lines sorted top-to-bottom.
 */
async function ocrExtractLines(
  imageBuffer: Buffer,
  imageWidth: number,
  imageHeight: number,
): Promise<TextLine[]> {
  const Tesseract = await import('tesseract.js')

  const worker = await Tesseract.createWorker('heb+eng')

  try {
    const {
      data: { blocks },
    } = await worker.recognize(imageBuffer, {}, { blocks: true })

    if (!blocks || blocks.length === 0) {
      return []
    }

    // Flatten blocks → paragraphs → lines, normalize coordinates
    const rawLines: { text: string; y: number; yBottom: number; x: number }[] = []

    for (const block of blocks) {
      if (!block.paragraphs) continue
      for (const paragraph of block.paragraphs) {
        if (!paragraph.lines) continue
        for (const line of paragraph.lines) {
          const text = line.text.trim()
          if (!text) continue

          // Tesseract bbox is in pixel coordinates — normalize to 0-1
          const y = line.bbox.y0 / imageHeight
          const yBottom = line.bbox.y1 / imageHeight
          const x = line.bbox.x0 / imageWidth

          rawLines.push({ text, y, yBottom, x })
        }
      }
    }

    // Sort by Y (top to bottom), then X
    rawLines.sort((a, b) => a.y - b.y || a.x - b.x)

    // Group lines at the same Y-level (within tolerance)
    const mergedLines: TextLine[] = []
    let current: { texts: string[]; y: number; yBottom: number; x: number } | null = null

    for (const item of rawLines) {
      if (!current || Math.abs(item.y - current.y) > LINE_Y_TOLERANCE) {
        if (current) {
          mergedLines.push({
            text: current.texts.join(' ').trim(),
            y: current.y,
            yBottom: current.yBottom,
            x: current.x,
          })
        }
        current = {
          texts: [item.text],
          y: item.y,
          yBottom: item.yBottom,
          x: item.x,
        }
      } else {
        current.texts.push(item.text)
        current.yBottom = Math.max(current.yBottom, item.yBottom)
        current.x = Math.min(current.x, item.x)
      }
    }

    if (current) {
      mergedLines.push({
        text: current.texts.join(' ').trim(),
        y: current.y,
        yBottom: current.yBottom,
        x: current.x,
      })
    }

    return mergedLines
  } finally {
    await worker.terminate()
  }
}

/**
 * Match a text line against exercise label patterns.
 */
function matchExerciseLabel(text: string): { label: string } | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  for (const { pattern, labelExtractor } of EXERCISE_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) {
      return { label: labelExtractor(match) }
    }
  }

  return null
}
