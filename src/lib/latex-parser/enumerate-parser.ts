/**
 * Parses \begin{enumerate}[label=\alph*.] environments into question blocks.
 *
 * Bagrut exam pattern:
 *   \begin{enumerate}[label=\textbf{\alph*.}]
 *   \item question text a
 *   \item question text b
 *   \end{enumerate}
 *
 * Also handles start= option for continuation:
 *   \begin{enumerate}[label=\textbf{\alph*.}, start=2]
 */

import type { ContentBlock } from '@/server/payload/collections/Exercises/types'
import { makeFreeResponseBlock, makeRichTextBlock } from '@/lib/latex-parser/block-generators'

/** Extract the start index from enumerate options like [label=\alph*., start=3] */
function parseStartIndex(envContent: string): number {
  const startMatch = /start=(\d+)/.exec(envContent)
  return startMatch ? parseInt(startMatch[1], 10) : 1
}

/** Convert a 1-based index to a Hebrew-style label (a, b, c...) */
function indexToLabel(index: number): string {
  return String.fromCharCode(96 + index) // 1->a, 2->b, etc.
}

/** Clean LaTeX formatting from item text */
function cleanItemText(text: string): string {
  return text
    .replace(/\\textbf\{([^}]*)\}/g, '**$1**')
    .replace(/\\textit\{([^}]*)\}/g, '*$1*')
    .replace(/\\emph\{([^}]*)\}/g, '*$1*')
    .replace(/\\underline\{([^}]*)\}/g, '$1')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\\\/g, '\n')
    .replace(/\\vspace\{[^}]*\}/g, '')
    .replace(/\\noindent/g, '')
    .trim()
}

/**
 * Parses the inner content of an enumerate environment into content blocks.
 * Each \item becomes a question_free_response block.
 */
export function parseEnumerate(innerContent: string): ContentBlock[] {
  const blocks: ContentBlock[] = []

  // Extract start index from the enumerate options (if present in the raw env text)
  const startIndex = parseStartIndex(innerContent)

  // Split on \item markers
  const parts = innerContent.split(/\\item\s*/)

  // First part is pre-item text (options, whitespace) — skip it
  for (let i = 1; i < parts.length; i++) {
    const raw = parts[i].trim()
    if (!raw) continue

    const label = indexToLabel(startIndex + i - 1)
    const cleaned = cleanItemText(raw)

    if (!cleaned) continue

    // Check if this has sub-parts like (1), (2)
    const hasSubParts = /\(1\)/.test(cleaned)

    if (hasSubParts) {
      // Keep as a single free response with sub-parts in the prompt
      blocks.push(makeFreeResponseBlock(`${label}. ${cleaned}`))
    } else {
      blocks.push(makeFreeResponseBlock(`${label}. ${cleaned}`))
    }
  }

  return blocks
}

/**
 * Checks if an enumerate environment contains solution content
 * (used in \section*{פתרון} sections).
 */
export function parseEnumerateSolutions(innerContent: string): string[] {
  const solutions: string[] = []
  const parts = innerContent.split(/\\item\s*/)

  for (let i = 1; i < parts.length; i++) {
    const raw = parts[i].trim()
    if (!raw) continue
    solutions.push(cleanItemText(raw))
  }

  return solutions
}

/**
 * Checks if this is a solution section header.
 * Matches: \section*{פתרון תרגיל 1} or similar Hebrew patterns.
 */
export function isSolutionHeader(text: string): boolean {
  return /\\section\*?\{פתרון/.test(text)
}

/**
 * Detects if this is an exercise title.
 * Matches: \textbf{תרגיל 1 - Title} or \textbf{תרגיל 1}
 */
export function isExerciseTitle(text: string): { title: string; number: number } | null {
  const match = /\\textbf\{(תרגיל\s+(\d+)[^}]*)\}/.exec(text)
  if (!match) return null
  return { title: match[1], number: parseInt(match[2], 10) }
}

/** Check if text contains an enumerate-style exercise pattern */
export function isEnumerateExercise(envContent: string): boolean {
  return /\\item/.test(envContent) && /label\s*=/.test(envContent)
}

/**
 * Convert rich_text blocks into context paragraphs.
 * Used to prepend narrative text before sub-questions.
 */
export function makeContextBlock(text: string): ContentBlock {
  const cleaned = cleanItemText(text)
  return makeRichTextBlock(cleaned)
}
