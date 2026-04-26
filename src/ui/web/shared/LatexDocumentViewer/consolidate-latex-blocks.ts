/**
 * @fileType utility
 * @domain latex
 * @pattern aggregator
 * @ai-summary Walks an ordered list of exercises and concatenates every LaTeX block
 *             (type: 'latex') into a single LaTeX source suitable for LatexDocumentViewer.
 *             Used by practice/exam lessons to present all LaTeX content as one document.
 */

import type { LatexBlock } from '@/server/payload/collections/Exercises/types'

/** Shape of an exercise block carrying LaTeX source. Loosely typed to match Exercise.content. */
interface LooseBlock {
  type?: string
  latex?: string
  renderMode?: 'block' | 'inline'
}

/** Minimal shape of an Exercise required to extract LaTeX blocks. */
export interface ExerciseLatexSource {
  id: string
  title?: string | null
  content: unknown
}

export interface ConsolidatedLatexResult {
  /** Concatenated LaTeX source ready to feed into LatexDocumentViewer. Empty string when nothing was found. */
  latex: string
  /** Number of LaTeX blocks aggregated across all exercises. */
  blockCount: number
  /** Convenience flag: true when at least one LaTeX block was found. */
  hasContent: boolean
}

/**
 * Normalise a user-authored title for emission as a markdown H2 heading.
 *
 * We deliberately avoid wrapping titles in `\section*{...}` because the
 * downstream `latexToMarkdownWithDiagrams` pipeline matches it with
 * `\\section\*?\{([^}]+)\}` — a regex that terminates at the first literal
 * `}`. Any LaTeX escape for `\`, `{`, `}`, `^`, or `~` either reintroduces
 * `}` (via `{}`-form accents or `\textbackslash{}`) or produces LaTeX
 * accent commands — both break the heading or distort the output.
 *
 * Emitting `## <title>` directly sidesteps the problem: markdown headings
 * pass through the LaTeX→markdown pipeline untouched and don't need any
 * LaTeX-level escaping. The only constraint is keeping the title on one
 * line, hence whitespace normalisation.
 */
function normaliseTitleForHeading(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function extractBlocksArray(content: unknown): LooseBlock[] {
  if (Array.isArray(content)) return content as LooseBlock[]
  if (content && typeof content === 'object' && 'blocks' in content) {
    const raw = (content as { blocks?: unknown }).blocks
    if (Array.isArray(raw)) return raw as LooseBlock[]
  }
  return []
}

function isLatexBlock(block: unknown): block is LatexBlock {
  if (!block || typeof block !== 'object') return false
  const b = block as LooseBlock
  return b.type === 'latex' && typeof b.latex === 'string' && b.latex.length > 0
}

/**
 * Aggregate every LaTeX block across the given exercises into a single LaTeX source.
 *
 * Output shape per exercise (only when the exercise contributes LaTeX):
 *   ## Exercise Title                 (omitted when the exercise has no title)
 *   <latex block 1>
 *   <latex block 2>
 *
 * Exercise boundaries are separated by blank lines, which `latexToMarkdownWithDiagrams`
 * collapses into paragraph breaks — visually distinct but flowing as one document.
 * Titles are emitted as markdown H2 headings rather than `\section*{...}` so that
 * arbitrary characters (braces, backslashes, carets, tildes) don't interact with the
 * LaTeX parsing regexes in the downstream pipeline.
 */
export function consolidateLatexBlocks(
  exercises: ReadonlyArray<ExerciseLatexSource>,
): ConsolidatedLatexResult {
  const parts: string[] = []
  let blockCount = 0

  for (const exercise of exercises) {
    const blocks = extractBlocksArray(exercise.content)
    const latexBlocks = blocks.filter(isLatexBlock)
    if (latexBlocks.length === 0) continue

    const title = exercise.title ? normaliseTitleForHeading(exercise.title) : ''
    if (title) {
      parts.push(`## ${title}`)
    }

    for (const block of latexBlocks) {
      parts.push(block.latex.trim())
      blockCount++
    }
  }

  return {
    latex: parts.join('\n\n'),
    blockCount,
    hasContent: blockCount > 0,
  }
}
