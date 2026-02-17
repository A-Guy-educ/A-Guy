/**
 * V2 Vision+Text Combo Exercise Detection Service
 *
 * Combines Vision LLM semantic understanding with text extraction precision:
 * 1. Vision LLM identifies exercise labels and approximate Y-positions
 * 2. Text lines from pdfjs provide exact Y-coordinates
 * 3. Each LLM detection is "snapped" to the nearest text line
 *
 * This handles PDFs where regex patterns don't match exercise labels
 * (unknown formats, unusual numbering) — the LLM understands the semantics
 * while text extraction provides pixel-accurate positions.
 *
 * @fileType service
 * @domain conversion
 * @pattern combo-detection, vision+text
 */

import type { Payload } from 'payload'
import type { TextLine } from './text-detection-service'
import {
  detectExerciseStarts,
  type ExerciseStart,
  type PageDetectionResult,
} from './vision-detection-service'

/**
 * Maximum Y-distance (normalized 0-1) to snap a Vision LLM detection
 * to a text line. Beyond this, the detection is considered unreliable.
 * ~5% of page height ≈ ~2 text lines.
 */
const SNAP_TOLERANCE = 0.05

/**
 * Detect exercises using Vision LLM, then snap Y-positions to text lines.
 *
 * @param pageImageBuffer - Rendered page image (PNG)
 * @param pageIndex - 0-based page index (for logging)
 * @param textLines - Pre-extracted text lines for this page (from pdfjs)
 * @param allPagesTextLines - Text lines from all pages (for content bounds)
 * @param payload - Payload instance (needed for LLM provider)
 * @returns Detection result with text-precise Y-coordinates
 */
export async function detectExercisesVisionCombo(
  pageImageBuffer: Buffer,
  pageIndex: number,
  textLines: TextLine[],
  allPagesTextLines: TextLine[][],
  payload: Payload,
): Promise<PageDetectionResult> {
  // Step 1: Get Vision LLM detections (approximate Y-positions)
  const visionResult = await detectExerciseStarts(pageImageBuffer, payload)

  console.log(
    `[V2-Combo] Page ${pageIndex}: Vision LLM found ${visionResult.exercises.length} exercise(s), continues=${visionResult.continuesFromPrevious}`,
  )
  for (const ex of visionResult.exercises) {
    console.log(
      `[V2-Combo]   Vision: label="${ex.label}" approxY=${ex.startY.toFixed(3)}`,
    )
  }

  if (visionResult.exercises.length === 0) {
    // LLM found no exercises — use text-based content bounds
    const contentBounds = computeContentBounds(textLines, allPagesTextLines, pageIndex)
    return {
      ...contentBounds,
      continuesFromPrevious: visionResult.continuesFromPrevious,
      exercises: [],
    }
  }

  // Step 2: Filter text lines (remove headers/footers)
  const contentLines = filterContentLines(textLines, allPagesTextLines)

  if (contentLines.length === 0) {
    // No text lines to snap to — use Vision LLM positions as-is
    console.log(`[V2-Combo] Page ${pageIndex}: no text lines, using Vision positions directly`)
    return visionResult
  }

  // Step 3: Snap each Vision detection to nearest text line
  const snappedExercises: ExerciseStart[] = []
  for (const visionEx of visionResult.exercises) {
    const snapped = snapToNearestLine(visionEx, contentLines)
    if (snapped) {
      console.log(
        `[V2-Combo]   Snapped "${visionEx.label}" from y=${visionEx.startY.toFixed(3)} → y=${snapped.startY.toFixed(3)} (line: "${snapped.matchedLineText}")`,
      )
      snappedExercises.push({
        label: visionEx.label,
        startY: snapped.startY,
      })
    } else {
      // No nearby text line — use Vision position as fallback
      console.log(
        `[V2-Combo]   No snap for "${visionEx.label}" at y=${visionEx.startY.toFixed(3)} (no text line within tolerance), using Vision position`,
      )
      snappedExercises.push(visionEx)
    }
  }

  // Sort by Y position
  snappedExercises.sort((a, b) => a.startY - b.startY)

  // Compute content bounds from text lines
  const contentBounds = computeContentBounds(textLines, allPagesTextLines, pageIndex)

  // Determine continuesFromPrevious using same logic as text detection
  const LINE_Y_TOLERANCE = 0.005
  const continuesFromPrevious =
    snappedExercises.length > 0 &&
    snappedExercises[0].startY - contentBounds.contentStartY > LINE_Y_TOLERANCE * 3

  return {
    contentStartY: contentBounds.contentStartY,
    contentEndY: contentBounds.contentEndY,
    continuesFromPrevious,
    exercises: snappedExercises,
  }
}

/**
 * Snap a Vision LLM detection to the nearest text line.
 * Searches within SNAP_TOLERANCE for the closest text line by Y-coordinate.
 */
function snapToNearestLine(
  visionExercise: ExerciseStart,
  textLines: TextLine[],
): { startY: number; matchedLineText: string } | null {
  let bestLine: TextLine | null = null
  let bestDistance = Infinity

  for (const line of textLines) {
    const distance = Math.abs(line.y - visionExercise.startY)
    if (distance < bestDistance && distance <= SNAP_TOLERANCE) {
      bestDistance = distance
      bestLine = line
    }
  }

  if (!bestLine) return null

  return {
    startY: bestLine.y,
    matchedLineText: bestLine.text.substring(0, 60),
  }
}

/**
 * Compute content region bounds from text lines, excluding headers/footers.
 */
function computeContentBounds(
  textLines: TextLine[],
  allPagesTextLines: TextLine[][],
  _pageIndex: number,
): { contentStartY: number; contentEndY: number } {
  const contentLines = filterContentLines(textLines, allPagesTextLines)

  if (contentLines.length === 0) {
    return { contentStartY: 0, contentEndY: 1 }
  }

  return {
    contentStartY: contentLines[0].y,
    contentEndY: contentLines[contentLines.length - 1].yBottom,
  }
}

/**
 * Filter out header/footer lines that repeat across pages.
 * Simplified version — same logic as text-detection-service.
 */
function filterContentLines(
  pageLines: TextLine[],
  allPagesTextLines: TextLine[][],
): TextLine[] {
  if (allPagesTextLines.length <= 1) return pageLines

  const HEADER_ZONE = 0.08
  const FOOTER_ZONE = 0.92

  const headerCounts = new Map<string, number>()
  const footerCounts = new Map<string, number>()

  for (const lines of allPagesTextLines) {
    const pageHeaderTexts = new Set<string>()
    const pageFooterTexts = new Set<string>()

    for (const line of lines) {
      const normalized = line.text.trim().toLowerCase()
      if (!normalized) continue
      if (line.y < HEADER_ZONE) pageHeaderTexts.add(normalized)
      if (line.y > FOOTER_ZONE) pageFooterTexts.add(normalized)
    }

    for (const t of pageHeaderTexts) {
      headerCounts.set(t, (headerCounts.get(t) || 0) + 1)
    }
    for (const t of pageFooterTexts) {
      footerCounts.set(t, (footerCounts.get(t) || 0) + 1)
    }
  }

  const minPages = Math.min(2, allPagesTextLines.length)
  const headerTexts = new Set<string>()
  const footerTexts = new Set<string>()

  for (const [text, count] of headerCounts) {
    if (count >= minPages) headerTexts.add(text)
  }
  for (const [text, count] of footerCounts) {
    if (count >= minPages) footerTexts.add(text)
  }

  return pageLines.filter((line) => {
    const normalized = line.text.trim().toLowerCase()
    if (line.y < HEADER_ZONE && headerTexts.has(normalized)) return false
    if (line.y > FOOTER_ZONE && footerTexts.has(normalized)) return false
    return true
  })
}
