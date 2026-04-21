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

/**
 * Detect if this enumerate is a top-level exercise list.
 * Must use \arabic*. label (with period, not parens) AND have large itemsep.
 * This distinguishes exercise lists from MCQ sub-options.
 */
function isExerciseEnumerate(envContent: string): boolean {
  // Must have \arabic*. or \arabic* followed by a period in the label
  const hasArabicLabel = /label\s*=\s*\\textbf\{\\arabic\*\.\}/.test(envContent)
  // Large itemsep indicates exercise-level spacing (>= 1cm)
  const hasLargeSpacing = /itemsep\s*=\s*(1(\.\d+)?|[2-9](\.\d+)?)\s*cm/.test(envContent)
  return hasArabicLabel && hasLargeSpacing
}

/** Convert a 1-based index to a label (a, b, c...) — kept for potential future use */
function _indexToLabel(index: number): string {
  return String.fromCharCode(96 + index) // 1->a, 2->b, etc.
}

/** Find matching closing brace with nesting support. */
function findMatchingBrace(text: string, openPos: number): number {
  let depth = 1
  for (let i = openPos + 1; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * Strip {\color{...} content} groups using brace counting
 * to handle nested braces like \frac{1}{...}.
 */
function stripColorAndSizing(text: string): string {
  let result = text
  let i = 0
  let output = ''
  while (i < result.length) {
    if (result[i] === '{') {
      const after = result.slice(i + 1)
      const cmdMatch =
        /^\\(?:Large|large|huge|Huge)\s*\\color\{[^}]*\}\s*/.exec(after) ||
        /^\\color\{[^}]*\}\s*/.exec(after) ||
        /^\\(?:Large|large|huge|Huge)\s*/.exec(after)
      if (cmdMatch) {
        const closingBrace = findMatchingBrace(result, i)
        if (closingBrace > i) {
          output += result.slice(i + 1 + cmdMatch[0].length, closingBrace)
          i = closingBrace + 1
          continue
        }
      }
    }
    output += result[i]
    i++
  }
  result = output
    .replace(/\\(?:Large|large|huge|Huge|normalsize|small|footnotesize|tiny)\s*/g, '')
    .replace(/\\color\{[^}]*\}/g, '')
    .replace(/\\definecolor\{[^}]*\}\{[^}]*\}\{[^}]*\}/g, '')
  return result
}

/** Clean LaTeX formatting from item text */
function cleanItemText(text: string): string {
  return (
    stripColorAndSizing(text)
      // Convert \begin{itemize}...\end{itemize} to bullet points
      .replace(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g, (_match, inner: string) => {
        const items = inner.split(/\\item\s*/).filter((s: string) => s.trim())
        return items.map((item: string) => `\n• ${item.trim()}`).join('')
      })
      // Strip leaked environment tags
      .replace(
        /\\(?:begin|end)\{(?:enumerate|center|itemize|tabular\*?|tcolorbox)\}(?:\[[^\]]*\])?/g,
        '',
      )
      .replace(/\\selectlanguage\{[^}]*\}/g, '')
      // Strip tikzpicture blocks that leaked into items
      .replace(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g, '')
      // Strip [(N)] labels that survived pre-processing
      .replace(/^\[\(?\d+\)?\]\s*/g, '')
      .replace(/\\textbf\{([^}]*)\}/g, '**$1**')
      .replace(/\\textit\{([^}]*)\}/g, '*$1*')
      .replace(/\\emph\{([^}]*)\}/g, '*$1*')
      .replace(/\\underline\{([^}]*)\}/g, '$1')
      .replace(/\\text\{([^}]*)\}/g, '$1')
      .replace(/\\\\/g, ' ')
      .replace(/\\vspace\{[^}]*\}/g, ' ')
      .replace(/\\noindent/g, '')
      // Collapse whitespace into single spaces
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/**
 * Parses the inner content of an enumerate environment into content blocks.
 * Each \item becomes a question_free_response block.
 *
 * Supports two label styles:
 *   - label=\alph*. with optional start=N  →  auto-generated a, b, c labels
 *   - \item[\textbf{א.}] explicit Hebrew labels
 */
export function parseEnumerate(innerContent: string): ContentBlock[] {
  const blocks: ContentBlock[] = []

  // Extract start index from the enumerate options (if present in the raw env text)
  const startIndex = parseStartIndex(innerContent)
  const isNumbered = isExerciseEnumerate(innerContent)

  // Pre-process: convert nested environments to inline text
  // before splitting on \item, to avoid splitting inside nested environments
  let preprocessed = innerContent
  // Convert \begin{itemize}...\end{itemize} to inline bullet text
  preprocessed = preprocessed.replace(
    /\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g,
    (_match, inner: string) => {
      const items = inner.split(/\\item\s*/).filter((s: string) => s.trim())
      return items.map((item: string) => `\n(${item.trim()})`).join(' ')
    },
  )
  // Convert nested \begin{enumerate}...\end{enumerate} (MCQ sub-options) to inline text
  preprocessed = preprocessed.replace(
    /\\begin\{enumerate\}\s*\[label=\(\\textbf\{\\arabic\*\}\)[^\]]*\]([\s\S]*?)\\end\{enumerate\}/g,
    (_match, inner: string) => {
      const items = inner.split(/\\item\s*/).filter((s: string) => s.trim())
      return items.map((item: string, idx: number) => `\n(${idx + 1}) ${item.trim()}`).join('')
    },
  )

  // Split on \item markers — handles both \item and \item[label]
  const parts = preprocessed.split(/\\item\s*/)

  // First part is pre-item text (options, whitespace) — skip it
  for (let i = 1; i < parts.length; i++) {
    const raw = parts[i].trim()
    if (!raw) continue

    // Strip explicit label at the start:
    //   [\textbf{א.}]  [\textbf{(1)}]  [(1)]  [(א)]  [א.]
    const explicitLabelMatch =
      /^\[\\textbf\{([^}]*)\}\]\s*/.exec(raw) || /^\[\(?[\u0590-\u05FFa-z\d]+\.?\)?\]\s*/.exec(raw)
    const content = explicitLabelMatch ? raw.slice(explicitLabelMatch[0].length).trim() : raw

    const cleaned = cleanItemText(content)
    if (!cleaned) continue

    // For numbered exercises (\arabic* label), emit an exercise heading
    // so that parseLatexToExercises can split on it
    if (isNumbered) {
      const num = startIndex + i - 1
      blocks.push(makeRichTextBlock(`## תרגיל ${num}`))
    }

    // Don't prepend labels — the frontend handles numbering automatically
    blocks.push(makeFreeResponseBlock(cleaned))
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
 * Matches: \section*{פתרון תרגיל 1}, \subsection*{פתרון תרגיל 1},
 * \textbf{פתרון שאלה 1:}, \section*{פתרונות לתרגילים},
 * \subsection*{תשובה סופית - שאלה 1}
 */
export function isSolutionHeader(text: string): boolean {
  return (
    /\\(?:section|subsection)\*?\{פתרון/.test(text) ||
    /\\(?:section|subsection)\*?\{פתרונות/.test(text) ||
    /\\textbf\{פתרון\s+(?:תרגיל|שאלה)/.test(text) ||
    /\\(?:section|subsection)\*?\{תשובה\s+סופית/.test(text)
  )
}

/**
 * Detects if this is an exercise title.
 * Matches:
 *   \textbf{תרגיל 1 - Title} or \textbf{תרגיל 1}
 *   \section*{תרגיל 1: Title} or \subsection*{תרגיל 1}
 *   \section*{שאלה 1} or \subsection*{שאלה 1}
 *   \textbf{N.} standalone numbered exercise (e.g. \textbf{1.})
 */
export function isExerciseTitle(text: string): { title: string; number: number } | null {
  // \textbf{תרגיל N ...}
  const textbfMatch = /\\textbf\{(תרגיל\s+(\d+)[^}]*)\}/.exec(text)
  if (textbfMatch) return { title: textbfMatch[1], number: parseInt(textbfMatch[2], 10) }

  // \section*{תרגיל N ...} or \subsection*{תרגיל N ...}
  const sectionExMatch = /\\(?:section|subsection)\*?\{(תרגיל\s+(\d+)[^}]*)\}/.exec(text)
  if (sectionExMatch) return { title: sectionExMatch[1], number: parseInt(sectionExMatch[2], 10) }

  // \section*{שאלה N ...} or \subsection*{שאלה N ...}
  const sectionQMatch = /\\(?:section|subsection)\*?\{(שאלה\s+(\d+)[^}]*)\}/.exec(text)
  if (sectionQMatch) return { title: sectionQMatch[1], number: parseInt(sectionQMatch[2], 10) }

  // \textbf{N.} — standalone numbered exercise boundary
  const numberedMatch = /^\\textbf\{(\d+)\.\s*\}$/.exec(text.trim())
  if (numberedMatch) {
    const num = parseInt(numberedMatch[1], 10)
    return { title: `תרגיל ${num}`, number: num }
  }

  return null
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
