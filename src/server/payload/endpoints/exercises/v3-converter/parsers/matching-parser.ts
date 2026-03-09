/**
 * V3 Converter - Matching Parser
 *
 * Parses matching structures into question_matching block schema format.
 *
 * @fileType utility
 * @domain conversion
 * @pattern parsing
 */

import { nanoid } from 'nanoid'

// ---------------------------------
// Types
// ---------------------------------

export interface MatchingOption {
  id: string
  content: string
}

export interface MatchingPair {
  optionId: string
  matchId: string
}

export interface ParsedMatching {
  leftColumn: MatchingOption[]
  rightColumn: MatchingOption[]
  correctPairs: MatchingPair[]
}

// ---------------------------------
// Main Parser
// ---------------------------------

/**
 * Parse matching content into left/right columns and correct pairs.
 * Handles various formats:
 * - "Item -> Match" format
 * - "Item | Match" format
 * - JSON format with type: "matching"
 */
export function parseMatching(content: string): ParsedMatching {
  const trimmed = content.trim()

  // Try JSON format first
  if (trimmed.startsWith('{')) {
    return parseMatchingJson(trimmed)
  }

  // Try text/arrow format
  if (/[→|=>]/.test(trimmed)) {
    return parseMatchingText(trimmed)
  }

  // Fallback: return empty matching
  return {
    leftColumn: [],
    rightColumn: [],
    correctPairs: [],
  }
}

/**
 * Parse JSON matching format
 */
function parseMatchingJson(json: string): ParsedMatching {
  try {
    const parsed = JSON.parse(json)

    if (parsed.type === 'matching') {
      return {
        leftColumn: parsed.leftColumn || [],
        rightColumn: parsed.rightColumn || [],
        correctPairs: parsed.correctPairs || [],
      }
    }
  } catch {
    // Not valid JSON, fall through
  }

  return {
    leftColumn: [],
    rightColumn: [],
    correctPairs: [],
  }
}

/**
 * Parse text matching format (e.g., "A -> 1" or "A | 1")
 */
function parseMatchingText(text: string): ParsedMatching {
  const lines = text.split('\n').filter((line) => line.trim())
  const leftItems: string[] = []
  const rightItems: string[] = []

  for (const line of lines) {
    // Split on arrow or pipe
    const parts = line.split(/[→|=>]+/).map((s) => s.trim())

    if (parts.length >= 2) {
      leftItems.push(parts[0])
      rightItems.push(parts[1])
    }
  }

  // Create options with generated IDs
  const leftColumn: MatchingOption[] = leftItems.map((content) => ({
    id: nanoid(),
    content,
  }))

  const rightColumn: MatchingOption[] = rightItems.map((content) => ({
    id: nanoid(),
    content,
  }))

  // Create correct pairs based on order
  const correctPairs: MatchingPair[] = leftColumn.map((left, idx) => ({
    optionId: left.id,
    matchId: rightColumn[idx]?.id || '',
  }))

  // Validate minimum requirements
  if (leftColumn.length < 2 || rightColumn.length < 2) {
    // Not enough items for matching
    return {
      leftColumn: [],
      rightColumn: [],
      correctPairs: [],
    }
  }

  return {
    leftColumn,
    rightColumn,
    correctPairs,
  }
}
