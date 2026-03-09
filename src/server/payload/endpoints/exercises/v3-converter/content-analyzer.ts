/**
 * V3 Converter - Content Feature Detector
 *
 * Analyzes subquestion content and detects functional/visual characteristics
 * used to drive mapping decisions. Pure function - no side effects.
 *
 * @fileType utility
 * @domain conversion
 * @pattern detection
 */

// ---------------------------------
// Feature Detection Types
// ---------------------------------

export interface DetectedFeatures {
  hasOptions: boolean
  hasMultipleCorrect: boolean
  hasTable: boolean
  hasMatching: boolean
  hasSvg: boolean
  hasHtml: boolean
  hasMedia: boolean
  hasGeometry: boolean
  hasAxisGraph: boolean
  hasLatex: boolean
  hasRichText: boolean
}

// ---------------------------------
// Detection Heuristics
// ---------------------------------

// Pattern for answer options (A., B., 1., 2., Hebrew letters)
const OPTIONS_PATTERN = /^(?:[A-Za-z]\.|\d+\.|[א-ת]\.)[\s]/m

const _TRUE_FALSE_PATTERN = /^(?:true|false)$/i

// Pattern for table HTML
const TABLE_PATTERN = /<table[\s\S]*?<\/table>/i

// Pattern for markdown table
const MARKDOWN_TABLE_PATTERN = /^\|.+\|$/m

// Pattern for matching (two column structure)
const _MATCHING_COLUMN_PATTERN = /^[A-Za-z0-9א-ת]+[\s]*[|.][\s]*[A-Za-z0-9א-ת]+/m

// Pattern for SVG markup
const SVG_PATTERN = /<svg[\s\S]*?<\/svg>/i

// Pattern for HTML tags (more than simple formatting)
const HTML_TAGS_PATTERN =
  /<(div|span|section|article|header|footer|table|thead|tbody|tr|th|td|ul|ol|li|blockquote|pre|code|a|img|picture|figure|figcaption)\b[\s\S]*?>/i

// Pattern for image references
const IMG_PATTERN = /<img[\s\S]*?>/i

// Image URL pattern
const IMAGE_URL_PATTERN =
  /(?:https?:\/\/|\/)[^\s<>"]+\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?[^\s<>"]*)?/i

// Geometry JSON pattern (basic detection)
const GEOMETRY_PATTERN = /\{[\s\S]*"type"\s*:\s*"geometry"[\s\S]*\}/i

// Axis graph JSON pattern
const AXIS_PATTERN = /\{[\s\S]*"type"\s*"(?::\s*axis|graph)"[\s\S]*\}/i

// LaTeX display math patterns
const LATEX_DISPLAY_PATTERN = /\$\$[\s\S]+?\$\$/
const LATEX_BLOCK_PATTERN = /\\\[[\s\S]+?\\\]/

// ---------------------------------
// Detection Functions
// ---------------------------------

/**
 * Detect features in content string.
 * Pure function - deterministic and side-effect free.
 */
export function detectFeatures(content: string): DetectedFeatures {
  if (!content || typeof content !== 'string') {
    return createEmptyFeatures()
  }

  const trimmed = content.trim()

  if (!trimmed) {
    return createEmptyFeatures()
  }

  // Check for options
  const hasOptions = detectOptions(trimmed)

  // Check for multiple correct answers
  const hasMultipleCorrect = detectMultipleCorrect(trimmed)

  // Check for table structures
  const hasTable = detectTable(trimmed)

  // Check for matching structures
  const hasMatching = detectMatching(trimmed)

  // Check for SVG
  const hasSvg = SVG_PATTERN.test(trimmed)

  // Check for HTML beyond simple formatting
  const hasHtml = HTML_TAGS_PATTERN.test(trimmed) && !hasTable

  // Check for media references
  const hasMedia = detectMedia(trimmed)

  // Check for geometry
  const hasGeometry = GEOMETRY_PATTERN.test(trimmed)

  // Check for axis graph
  const hasAxisGraph = AXIS_PATTERN.test(trimmed)

  // Check for LaTeX
  const hasLatex = LATEX_DISPLAY_PATTERN.test(trimmed) || LATEX_BLOCK_PATTERN.test(trimmed)

  // Rich text is default - plain text or inline math only
  const hasRichText = !(
    hasTable ||
    hasMatching ||
    hasSvg ||
    hasHtml ||
    hasMedia ||
    hasGeometry ||
    hasAxisGraph ||
    hasLatex ||
    hasOptions
  )

  return {
    hasOptions,
    hasMultipleCorrect,
    hasTable,
    hasMatching,
    hasSvg,
    hasHtml,
    hasMedia,
    hasGeometry,
    hasAxisGraph,
    hasLatex,
    hasRichText,
  }
}

/**
 * Detect answer options in content
 */
function detectOptions(content: string): boolean {
  // Check for explicit options array in JSON-like structure
  if (/"options"\s*:\s*\[/i.test(content)) {
    return true
  }

  // Check for option patterns like "A.", "1.", "a)"
  const lines = content.split('\n')
  let optionCount = 0

  for (const line of lines) {
    if (OPTIONS_PATTERN.test(line.trim())) {
      optionCount++
    }
  }

  // Consider it options if we have 2+ lines with option markers
  return optionCount >= 2
}

/**
 * Detect multiple correct answers
 */
function detectMultipleCorrect(content: string): boolean {
  // Check for multiple correct answer indicators
  // Look for patterns like "correctAnswers": [...] or "correct": [1, 2, 3]
  if (/"correctAnswers"\s*:\s*\[/i.test(content)) {
    const match = content.match(/"correctAnswers"\s*:\s*\[([^\]]+)\]/i)
    if (match) {
      const answers = match[1].split(',').map((s) => s.trim())
      return answers.length > 1
    }
  }

  if (/"correct"\s*:\s*\[/i.test(content)) {
    const match = content.match(/"correct"\s*:\s*\[([^\]]+)\]/i)
    if (match) {
      const answers = match[1].split(',').map((s) => s.trim())
      return answers.length > 1
    }
  }

  return false
}

/**
 * Detect table structures
 */
function detectTable(content: string): boolean {
  return TABLE_PATTERN.test(content) || MARKDOWN_TABLE_PATTERN.test(content)
}

/**
 * Detect matching structures (two-column patterns)
 */
function detectMatching(content: string): boolean {
  // Check for explicit matching JSON
  if (/"type"\s*:\s*"matching"/i.test(content)) {
    return true
  }

  // Check for two-column pattern with arrows or pipes
  const lines = content.split('\n')
  let columnLineCount = 0

  for (const line of lines) {
    const trimmed = line.trim()
    // Match patterns like "A | B" or "A -> B" or "A => B"
    if (/^[A-Za-z0-9א-ת][^\n|→=>]+[|→=>][^\n|→=>]+[A-Za-z0-9א-ת]$/.test(trimmed)) {
      columnLineCount++
    }
  }

  return columnLineCount >= 2
}

/**
 * Detect media references
 */
function detectMedia(content: string): boolean {
  // Check for img tags
  if (IMG_PATTERN.test(content)) {
    return true
  }

  // Check for image URLs
  if (IMAGE_URL_PATTERN.test(content)) {
    return true
  }

  // Check for media IDs in JSON
  if (/"mediaId"\s*:\s*["'][^"']+["']/i.test(content)) {
    return true
  }

  return false
}

/**
 * Create empty features object
 */
function createEmptyFeatures(): DetectedFeatures {
  return {
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
  }
}

/**
 * Get primary feature type from detected features
 * Used for determining segment type
 */
export function getPrimaryFeatureType(features: DetectedFeatures): string {
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
