import type { LatexToken } from '@/lib/latex-parser/types'
import { stripComments, parseEnvironment, countLines } from '@/lib/latex-parser/tokenizer-env'

// Matches \begin{envName}
const BEGIN_RE = /\\begin\{([^}]+)\}/g
// Matches display math $$...$$
const DISPLAY_MATH_RE = /\$\$[\s\S]*?\$\$/g
// Matches inline math $...$  (not $$)
const INLINE_MATH_RE = /(?<!\$)\$(?!\$)(?:[^$\\]|\\.)*\$(?!\$)/g
// Matches \commandName{arg}, \commandName*{arg}, or bare \commandName
const COMMAND_RE = /\\([a-zA-Z]+)\*?(?:\{[^}]*\})?/g

type Segment = {
  start: number
  end: number
  token: LatexToken
}

/**
 * Tokenizes a LaTeX string into a flat list of typed tokens.
 * Strips comments, then identifies environments, math, commands, and plain text.
 */
export function tokenize(src: string, baseLine = 0): LatexToken[] {
  const cleaned = stripComments(src)
  return parseSegments(cleaned, baseLine)
}

function parseSegments(src: string, baseLine: number): LatexToken[] {
  const segments: Segment[] = []
  let pos = 0

  while (pos < src.length) {
    // Try to match \begin{envName} at current scan position
    BEGIN_RE.lastIndex = pos
    const beginMatch = BEGIN_RE.exec(src)

    // Try display math $$...$$ from current pos
    DISPLAY_MATH_RE.lastIndex = pos
    const displayMath = DISPLAY_MATH_RE.exec(src)

    // Try inline math $...$ from current pos
    INLINE_MATH_RE.lastIndex = pos
    const inlineMath = INLINE_MATH_RE.exec(src)

    // Try command from current pos
    COMMAND_RE.lastIndex = pos
    const commandMatch = COMMAND_RE.exec(src)

    // Collect candidates that actually start at or after pos
    const candidates = [
      beginMatch && beginMatch.index >= pos
        ? { index: beginMatch.index, type: 'begin' as const, match: beginMatch }
        : null,
      displayMath && displayMath.index >= pos
        ? { index: displayMath.index, type: 'display' as const, match: displayMath }
        : null,
      inlineMath && inlineMath.index >= pos
        ? { index: inlineMath.index, type: 'inline' as const, match: inlineMath }
        : null,
      commandMatch && commandMatch.index >= pos
        ? { index: commandMatch.index, type: 'command' as const, match: commandMatch }
        : null,
    ].filter(Boolean) as Array<{ index: number; type: string; match: RegExpExecArray }>

    if (candidates.length === 0) {
      // Remaining text
      const remaining = src.slice(pos).trim()
      if (remaining.length > 0) {
        segments.push({
          start: pos,
          end: src.length,
          token: { type: 'text', value: remaining, line: baseLine + countLines(src, pos) },
        })
      }
      break
    }

    // Pick the earliest candidate
    candidates.sort((a, b) => a.index - b.index)
    const first = candidates[0]

    // Emit any text before this candidate
    if (first.index > pos) {
      const textVal = src.slice(pos, first.index).trim()
      if (textVal.length > 0) {
        segments.push({
          start: pos,
          end: first.index,
          token: { type: 'text', value: textVal, line: baseLine + countLines(src, pos) },
        })
      }
    }

    const line = baseLine + countLines(src, first.index)

    if (first.type === 'begin') {
      const envName = first.match[1]
      const beginTagEnd = first.match.index + first.match[0].length
      const result = parseEnvironment(
        src,
        first.match.index,
        envName,
        beginTagEnd,
        line,
        (inner, bl) => parseSegments(inner, bl),
      )
      if (result) {
        segments.push({ start: first.match.index, end: result.nextPos, token: result.token })
        pos = result.nextPos
      } else {
        // Unmatched \begin — skip past it
        pos = beginTagEnd
      }
    } else if (first.type === 'display') {
      segments.push({
        start: first.match.index,
        end: first.match.index + first.match[0].length,
        token: { type: 'math', value: first.match[0], line },
      })
      pos = first.match.index + first.match[0].length
    } else if (first.type === 'inline') {
      segments.push({
        start: first.match.index,
        end: first.match.index + first.match[0].length,
        token: { type: 'math', value: first.match[0], line },
      })
      pos = first.match.index + first.match[0].length
    } else if (first.type === 'command') {
      const cmdName = first.match[1]
      // Skip \begin/\end — handled separately
      if (cmdName === 'begin' || cmdName === 'end') {
        pos = first.match.index + first.match[0].length
        continue
      }
      segments.push({
        start: first.match.index,
        end: first.match.index + first.match[0].length,
        token: { type: 'command', name: cmdName, value: first.match[0], line },
      })
      pos = first.match.index + first.match[0].length
    }
  }

  return segments.map((s) => s.token)
}
