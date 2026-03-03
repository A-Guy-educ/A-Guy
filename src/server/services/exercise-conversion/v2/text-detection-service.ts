/**
 * V2 Text-based Exercise Detection Service
 *
 * Extracts text items from PDF pages using pdfjs-dist getTextContent(),
 * then pattern-matches exercise labels to find exact Y-positions.
 * Deterministic, fast, free — no LLM needed.
 *
 * @fileType service
 * @domain conversion
 * @pattern text-extraction, pattern-matching
 */

import type { ExerciseStart, PageDetectionResult } from './vision-detection-service'
import { logger } from '@/infra/utils/logger'

/**
 * A single line of text on the page, assembled from adjacent TextItems
 * sharing the same Y-coordinate.
 */
export interface TextLine {
  text: string
  y: number // normalized 0-1, top-origin
  yBottom: number // normalized 0-1, bottom of text
  x: number // normalized 0-1
}

/**
 * Exercise label patterns ordered by priority.
 *
 * Hebrew RTL text from pdfjs arrives reversed — the exercise number and dot
 * appear at the END of the line (e.g., "הבאים התרגילים את חשבו . 1").
 * We match BOTH start-of-line and end-of-line patterns, and require that
 * exercise labels contain Hebrew text (to distinguish from math sub-questions).
 */
const EXERCISE_PATTERNS: {
  pattern: RegExp
  labelExtractor: (match: RegExpMatchArray) => string
}[] = [
  // Hebrew keyword patterns (can appear at start or end due to RTL)
  { pattern: /שאלה\s*(\d+)/, labelExtractor: (m) => m[1] },
  { pattern: /תרגיל\s*(\d+)/, labelExtractor: (m) => m[1] },
  // RTL end-of-line: Hebrew text followed by ". N" at the end
  // e.g., "הבאים התרגילים את חשבו . 1"
  { pattern: /[\u0590-\u05FF].*[.]\s*(\d+)\s*$/, labelExtractor: (m) => m[1] },
  // LTR start-of-line: "N." followed by Hebrew text
  // e.g., "1. חשבו את התרגילים"
  { pattern: /^(\d+)\s*[.)]\s+[\u0590-\u05FF]/, labelExtractor: (m) => m[1] },
  // English patterns
  { pattern: /^Q(?:uestion)?\s*(\d+)/i, labelExtractor: (m) => m[1] },
  { pattern: /^Exercise\s*(\d+)/i, labelExtractor: (m) => m[1] },
  { pattern: /^Problem\s*(\d+)/i, labelExtractor: (m) => m[1] },
]

/**
 * Y-coordinate tolerance for grouping text items into the same line.
 * Items within this normalized distance are considered on the same line.
 */
const LINE_Y_TOLERANCE = 0.005

/**
 * Detect exercise start positions on a page using text extraction.
 *
 * @param pdfPage - pdfjs PDFPageProxy instance (using unknown to avoid complex pdfjs types)
 * @param pageIndex - 0-based page index
 * @param allPagesLines - text lines from all pages, for header/footer detection
 * @returns Detection result compatible with the strip-based pipeline
 */
export async function detectExerciseStartsFromText(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfPage: any,
  pageIndex: number,
  allPagesLines?: TextLine[][],
): Promise<PageDetectionResult> {
  const lines = await extractTextLines(pdfPage)

  logger.info({ pageIndex, lineCount: lines.length }, '[V2-TextDetect] Text lines extracted')
  if (lines.length > 0 && lines.length <= 30) {
    for (const line of lines) {
      logger.debug(
        { pageIndex, y: line.y, text: line.text.substring(0, 80) },
        '[V2-TextDetect] Text line',
      )
    }
  } else if (lines.length > 30) {
    // Log first 10 and last 5 lines
    for (const line of lines.slice(0, 10)) {
      logger.debug(
        { pageIndex, y: line.y, text: line.text.substring(0, 80) },
        '[V2-TextDetect] Text line',
      )
    }
    logger.debug({ pageIndex, omittedCount: lines.length - 15 }, '[V2-TextDetect] Omitted lines')
    for (const line of lines.slice(-5)) {
      logger.debug(
        { pageIndex, y: line.y, text: line.text.substring(0, 80) },
        '[V2-TextDetect] Text line',
      )
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

  // Filter out header/footer lines if we have cross-page data
  const contentLines =
    allPagesLines && allPagesLines.length > 1 ? filterHeaderFooter(lines, allPagesLines) : lines

  logger.info(
    { pageIndex, contentLineCount: contentLines.length },
    '[V2-TextDetect] Content lines after header/footer filter',
  )

  if (contentLines.length === 0) {
    return {
      contentStartY: 0,
      contentEndY: 1,
      continuesFromPrevious: false,
      exercises: [],
    }
  }

  // Content region = first to last content line
  const contentStartY = contentLines[0].y
  const contentEndY = contentLines[contentLines.length - 1].yBottom

  // Find exercise labels
  const exercises: ExerciseStart[] = []
  for (const line of contentLines) {
    const match = matchExerciseLabel(line.text)
    if (match) {
      logger.debug(
        { pageIndex, label: match.label, y: line.y, text: line.text.substring(0, 60) },
        '[V2-TextDetect] Matched exercise',
      )
      exercises.push({
        label: match.label,
        startY: line.y,
      })
    }
  }

  // Sort by Y position (top to bottom)
  exercises.sort((a, b) => a.startY - b.startY)

  // Determine if page continues from previous:
  // Only true when there ARE exercises on this page but the first one starts
  // well below the content start — meaning there's exercise content above it
  // that belongs to the previous page's last exercise.
  // Pages with NO exercises (theory, answer keys) are NOT continuations.
  const continuesFromPrevious =
    exercises.length > 0 && exercises[0].startY - contentStartY > LINE_Y_TOLERANCE * 3

  return { contentStartY, contentEndY, continuesFromPrevious, exercises }
}

/**
 * Extract text items from a PDF page and group them into lines.
 * Items at the same Y-coordinate (within tolerance) are concatenated.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function extractTextLines(pdfPage: any): Promise<TextLine[]> {
  const textContent = await pdfPage.getTextContent()
  const viewport = pdfPage.getViewport({ scale: 1.0 })
  const pageHeight = viewport.height

  if (!textContent.items || textContent.items.length === 0) {
    return []
  }

  // Convert text items to normalized coordinates
  const items: { text: string; x: number; y: number; height: number }[] = []

  for (const item of textContent.items) {
    if (!('str' in item) || !item.str.trim()) continue

    const pdfY = item.transform[5]
    const pdfX = item.transform[4]
    const itemHeight = item.height || item.transform[3] || 0

    // Convert PDF coords (bottom-origin) to normalized top-origin 0-1
    const normalizedY = 1 - pdfY / pageHeight
    const normalizedX = pdfX / viewport.width
    const normalizedHeight = itemHeight / pageHeight

    items.push({
      text: item.str,
      x: normalizedX,
      y: normalizedY,
      height: normalizedHeight,
    })
  }

  // Sort by Y (top to bottom), then X (left to right)
  items.sort((a, b) => a.y - b.y || a.x - b.x)

  // Group into lines by Y-coordinate proximity
  const lines: TextLine[] = []
  let currentLine: { texts: string[]; y: number; maxHeight: number; minX: number } | null = null

  for (const item of items) {
    if (!currentLine || Math.abs(item.y - currentLine.y) > LINE_Y_TOLERANCE) {
      // Start new line
      if (currentLine) {
        lines.push({
          text: currentLine.texts.join(' ').trim(),
          y: currentLine.y,
          yBottom: currentLine.y + currentLine.maxHeight,
          x: currentLine.minX,
        })
      }
      currentLine = {
        texts: [item.text],
        y: item.y,
        maxHeight: item.height,
        minX: item.x,
      }
    } else {
      // Same line — append text
      currentLine.texts.push(item.text)
      currentLine.maxHeight = Math.max(currentLine.maxHeight, item.height)
      currentLine.minX = Math.min(currentLine.minX, item.x)
    }
  }

  // Don't forget the last line
  if (currentLine) {
    lines.push({
      text: currentLine.texts.join(' ').trim(),
      y: currentLine.y,
      yBottom: currentLine.y + currentLine.maxHeight,
      x: currentLine.minX,
    })
  }

  return lines
}

/**
 * Match a text line against exercise label patterns.
 * Returns the label if matched, null otherwise.
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

/**
 * Filter out header/footer lines by detecting text that repeats
 * across multiple pages in the same Y-position zone.
 */
function filterHeaderFooter(pageLines: TextLine[], allPagesLines: TextLine[][]): TextLine[] {
  const HEADER_ZONE = 0.08 // top 8%
  const FOOTER_ZONE = 0.92 // bottom 8%

  // Collect texts that appear in header/footer zones across pages
  const headerTexts = new Set<string>()
  const footerTexts = new Set<string>()

  // Count how many pages each header/footer-zone text appears on
  const headerCounts = new Map<string, number>()
  const footerCounts = new Map<string, number>()

  for (const lines of allPagesLines) {
    const pageHeaderTexts = new Set<string>()
    const pageFooterTexts = new Set<string>()

    for (const line of lines) {
      const normalized = line.text.trim().toLowerCase()
      if (!normalized) continue

      if (line.y < HEADER_ZONE) {
        pageHeaderTexts.add(normalized)
      }
      if (line.y > FOOTER_ZONE) {
        pageFooterTexts.add(normalized)
      }
    }

    for (const t of pageHeaderTexts) {
      headerCounts.set(t, (headerCounts.get(t) || 0) + 1)
    }
    for (const t of pageFooterTexts) {
      footerCounts.set(t, (footerCounts.get(t) || 0) + 1)
    }
  }

  // Text appearing on 2+ pages in header/footer zone is a header/footer
  const minPages = Math.min(2, allPagesLines.length)
  for (const [text, count] of headerCounts) {
    if (count >= minPages) headerTexts.add(text)
  }
  for (const [text, count] of footerCounts) {
    if (count >= minPages) footerTexts.add(text)
  }

  // Filter out matching lines
  return pageLines.filter((line) => {
    const normalized = line.text.trim().toLowerCase()
    if (line.y < HEADER_ZONE && headerTexts.has(normalized)) return false
    if (line.y > FOOTER_ZONE && footerTexts.has(normalized)) return false
    return true
  })
}

/**
 * Extract text lines from all pages of a PDF document.
 * Used for cross-page header/footer detection.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function extractAllPagesTextLines(pdfPages: any[]): Promise<TextLine[][]> {
  const allLines: TextLine[][] = []
  for (const page of pdfPages) {
    allLines.push(await extractTextLines(page))
  }
  return allLines
}
