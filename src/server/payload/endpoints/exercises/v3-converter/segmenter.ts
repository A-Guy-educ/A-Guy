/**
 * V3 Converter - Sequential Segmenter
 *
 * Splits mixed-format subquestion content into discrete ordered segments.
 * Uses regex heuristics to identify segment boundaries while preserving
 * exact original order.
 *
 * @fileType utility
 * @domain conversion
 * @pattern segmentation
 */

import { detectFeatures, type DetectedFeatures } from './content-analyzer'

// ---------------------------------
// Segment Types
// ---------------------------------

export type SegmentType =
  | 'rich_text'
  | 'table'
  | 'svg'
  | 'html'
  | 'media'
  | 'geometry'
  | 'axis_graph'
  | 'latex'
  | 'options'
  | 'matching'

export interface Segment {
  index: number
  type: SegmentType
  content: string
  features: DetectedFeatures
}

// ---------------------------------
// Segmentation Constants
// ---------------------------------

const MAX_SEGMENTS = 50

// ---------------------------------
// Segmentation Algorithm
// ---------------------------------

/**
 * Segment content into ordered blocks.
 *
 * Algorithm:
 * 1. Split on SVG blocks, table blocks, LaTeX blocks, media, geometry/axis JSON
 * 2. Everything between special blocks becomes a text segment
 * 3. Adjacent text segments are merged
 * 4. Max 50 segments enforced (NFR-007)
 *
 * @param content - The content string to segment
 * @returns Ordered array of segments preserving original order
 */
export function segmentContent(content: string): Segment[] {
  if (!content || typeof content !== 'string') {
    return [createEmptySegment(0)]
  }

  const trimmed = content.trim()
  if (!trimmed) {
    return [createEmptySegment(0)]
  }

  // Extract special blocks and their positions
  const specialBlocks = extractSpecialBlocks(trimmed)

  // If no special blocks found, treat as single rich_text segment
  if (specialBlocks.length === 0) {
    const features = detectFeatures(trimmed)
    return [
      {
        index: 0,
        type: getSegmentType(features),
        content: trimmed,
        features,
      },
    ]
  }

  // Sort by position
  specialBlocks.sort((a, b) => a.start - b.start)

  // Build segments
  const segments: Segment[] = []
  let currentIndex = 0

  for (const block of specialBlocks) {
    // Add text segment before this special block (if any)
    if (block.start > currentIndex) {
      const textContent = trimmed.slice(currentIndex, block.start).trim()
      if (textContent) {
        const features = detectFeatures(textContent)
        segments.push({
          index: segments.length,
          type: 'rich_text',
          content: textContent,
          features,
        })
      }
    }

    // Add the special block segment
    const features = detectFeatures(block.content)
    segments.push({
      index: segments.length,
      type: block.type,
      content: block.content,
      features,
    })

    currentIndex = block.end
  }

  // Add remaining text after last special block
  if (currentIndex < trimmed.length) {
    const textContent = trimmed.slice(currentIndex).trim()
    if (textContent) {
      const features = detectFeatures(textContent)
      segments.push({
        index: segments.length,
        type: 'rich_text',
        content: textContent,
        features,
      })
    }
  }

  // Enforce max segments limit
  if (segments.length > MAX_SEGMENTS) {
    // Merge excess segments into the last one
    const excess = segments.length - MAX_SEGMENTS
    const mergedContent = segments
      .slice(MAX_SEGMENTS - 1)
      .map((s) => s.content)
      .join('\n')
    segments.splice(MAX_SEGMENTS - 1, excess, {
      index: MAX_SEGMENTS - 1,
      type: 'rich_text',
      content: mergedContent,
      features: detectFeatures(mergedContent),
    })
  }

  // Re-index segments
  return segments.map((seg, idx) => ({ ...seg, index: idx }))
}

// ---------------------------------
// Helper Functions
// ---------------------------------

interface SpecialBlock {
  type: SegmentType
  content: string
  start: number
  end: number
}

/**
 * Extract special blocks from content
 */
function extractSpecialBlocks(content: string): SpecialBlock[] {
  const blocks: SpecialBlock[] = []

  // SVG blocks
  const svgRegex = /<svg[\s\S]*?<\/svg>/gi
  let match
  while ((match = svgRegex.exec(content)) !== null) {
    blocks.push({
      type: 'svg',
      content: match[0],
      start: match.index,
      end: match.index + match[0].length,
    })
  }

  // HTML tables
  const tableRegex = /<table[\s\S]*?<\/table>/gi
  while ((match = tableRegex.exec(content)) !== null) {
    blocks.push({
      type: 'table',
      content: match[0],
      start: match.index,
      end: match.index + match[0].length,
    })
  }

  // LaTeX display math ($$...$$)
  const latexDisplayRegex = /\$\$[\s\S]+?\$\$/g
  while ((match = latexDisplayRegex.exec(content)) !== null) {
    blocks.push({
      type: 'latex',
      content: match[0],
      start: match.index,
      end: match.index + match[0].length,
    })
  }

  // LaTeX block math (\[...\])
  const latexBlockRegex = /\\\[[\s\S]+?\\\]/g
  while ((match = latexBlockRegex.exec(content)) !== null) {
    blocks.push({
      type: 'latex',
      content: match[0],
      start: match.index,
      end: match.index + match[0].length,
    })
  }

  // Image tags
  const imgRegex = /<img[\s\S]*?>/gi
  while ((match = imgRegex.exec(content)) !== null) {
    blocks.push({
      type: 'media',
      content: match[0],
      start: match.index,
      end: match.index + match[0].length,
    })
  }

  // Geometry JSON (basic detection)
  const geometryRegex = /\{"type"\s*:\s*"geometry"[\s\S]*\}/gi
  while ((match = geometryRegex.exec(content)) !== null) {
    blocks.push({
      type: 'geometry',
      content: match[0],
      start: match.index,
      end: match.index + match[0].length,
    })
  }

  // Axis JSON
  const axisRegex = /\{"type"\s*:\s*"(?:axis|graph)"[\s\S]*\}/gi
  while ((match = axisRegex.exec(content)) !== null) {
    blocks.push({
      type: 'axis_graph',
      content: match[0],
      start: match.index,
      end: match.index + match[0].length,
    })
  }

  // Matching JSON
  const matchingRegex = /\{"type"\s*:\s*"matching"[\s\S]*\}/gi
  while ((match = matchingRegex.exec(content)) !== null) {
    blocks.push({
      type: 'matching',
      content: match[0],
      start: match.index,
      end: match.index + match[0].length,
    })
  }

  // Image URLs (outside of tags)
  const imageUrlRegex =
    /(?:^|[\s"'<])(https?:\/\/[^\s<>"']+\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?[^\s<>"']*)?)/gi
  let imageMatch: RegExpExecArray | null
  while ((imageMatch = imageUrlRegex.exec(content)) !== null) {
    // Avoid duplicate if already captured in img tag
    const existingAtPosition = blocks.some(
      (b) => b.start <= imageMatch!.index && b.end >= imageMatch!.index + imageMatch![1].length,
    )
    if (!existingAtPosition) {
      blocks.push({
        type: 'media',
        content: imageMatch[1],
        start: imageMatch.index + imageMatch[0].indexOf(imageMatch[1]),
        end: imageMatch.index + imageMatch[0].indexOf(imageMatch[1]) + imageMatch[1].length,
      })
    }
  }

  return blocks
}

/**
 * Get segment type from detected features
 */
function getSegmentType(features: DetectedFeatures): SegmentType {
  if (features.hasTable) return 'table'
  if (features.hasMatching) return 'matching'
  if (features.hasSvg) return 'svg'
  if (features.hasGeometry) return 'geometry'
  if (features.hasAxisGraph) return 'axis_graph'
  if (features.hasLatex) return 'latex'
  if (features.hasMedia) return 'media'
  if (features.hasHtml) return 'html'
  if (features.hasOptions) return 'options'
  return 'rich_text'
}

/**
 * Create empty segment
 */
function createEmptySegment(index: number): Segment {
  return {
    index,
    type: 'rich_text',
    content: '',
    features: {
      hasOptions: false,
      hasMultipleCorrect: false,
      hasTable: false,
      hasMatching: false,
      hasSvg: false,
      hasHtml: false,
      hasMedia: false,
      hasGeometry: false,
      hasAxisGraph: false,
      hasLatex: false,
      hasRichText: true,
    },
  }
}
