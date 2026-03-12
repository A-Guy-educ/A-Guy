import type { LatexToken } from '@/lib/latex-parser/types'

/**
 * Finds the matching \end{name} for a \begin{name}, respecting nesting.
 * Returns the index just after the closing \end{name}, or -1 if not found.
 */
export function findMatchingEnd(
  src: string,
  envName: string,
  startAfter: number,
): { endTagStart: number; endTagEnd: number } | null {
  const beginPattern = new RegExp(`\\\\begin\\{${escapeRegex(envName)}\\}`, 'g')
  const endPattern = new RegExp(`\\\\end\\{${escapeRegex(envName)}\\}`, 'g')

  let depth = 1
  let pos = startAfter

  while (pos < src.length && depth > 0) {
    beginPattern.lastIndex = pos
    endPattern.lastIndex = pos

    const nextBegin = beginPattern.exec(src)
    const nextEnd = endPattern.exec(src)

    if (!nextEnd) return null

    if (nextBegin && nextBegin.index < nextEnd.index) {
      depth++
      pos = nextBegin.index + nextBegin[0].length
    } else {
      depth--
      if (depth === 0) {
        return { endTagStart: nextEnd.index, endTagEnd: nextEnd.index + nextEnd[0].length }
      }
      pos = nextEnd.index + nextEnd[0].length
    }
  }

  return null
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Counts newlines in a substring to track line numbers.
 */
export function countLines(src: string, upTo: number): number {
  let count = 0
  for (let i = 0; i < upTo; i++) {
    if (src[i] === '\n') count++
  }
  return count
}

/** Strips LaTeX comments: % not preceded by \ until end of line. */
export function stripComments(src: string): string {
  return src.replace(/(^|[^\\])%[^\n]*/g, '$1')
}

/**
 * Parse an environment token (the outer \begin{name}...\end{name} block).
 * Returns the token and the position after \end{name}.
 */
export function parseEnvironment(
  src: string,
  beginIndex: number,
  envName: string,
  beginTagEnd: number,
  startLine: number,
  parseInner: (inner: string, baseLine: number) => LatexToken[],
): { token: LatexToken; nextPos: number } | null {
  const match = findMatchingEnd(src, envName, beginTagEnd)
  if (!match) return null

  const innerContent = src.slice(beginTagEnd, match.endTagStart)
  const innerBaseLine = startLine + countLines(src.slice(beginIndex, beginTagEnd), beginTagEnd)
  const children = parseInner(innerContent, innerBaseLine)
  const fullValue = src.slice(beginIndex, match.endTagEnd)

  return {
    token: {
      type: 'environment',
      name: envName,
      value: fullValue,
      line: startLine,
      children,
    },
    nextPos: match.endTagEnd,
  }
}
