/**
 * @fileType utility
 * @domain latex
 * @pattern converter
 * @ai-summary Converts raw LaTeX source to markdown+math for rendering via MathMarkdown.
 *             Handles Bagrut exam format: Hebrew enumerate, tabular, minipage, TikZ diagrams.
 *             Extracts TikZ diagrams and returns parsed specs for live rendering.
 */

import type { AxisSpecV1 } from '@/infra/contracts/graphics/axis.v1'
import type { GeometrySpecV1 } from '@/infra/contracts/graphics/geometry.v1'
import {
  parseTikzAxis,
  parseTikzDrawPlot,
  hasTikzAxis,
  hasTikzDrawPlot,
} from '@/lib/latex-parser/tikz-axis-parser'
import { parseTikzGeometry, hasTikzGeometry } from '@/lib/latex-parser/tikz-geometry-parser'

/** A parsed TikZ diagram ready for rendering */
export type ParsedDiagram =
  | { type: 'axis'; id: string; spec: AxisSpecV1 }
  | { type: 'geometry'; id: string; spec: GeometrySpecV1 }

/** Marker prefix used to identify diagram insertion points in the markdown */
const DIAGRAM_MARKER = '%%%TIKZ_DIAGRAM_'

/** Strip LaTeX preamble: everything before \begin{document} + the command itself, and \end{document} */
function stripPreamble(latex: string): string {
  let result = latex
  const beginDoc = result.indexOf('\\begin{document}')
  if (beginDoc !== -1) {
    result = result.slice(beginDoc + '\\begin{document}'.length)
  }
  result = result.replace(/\\end\{document\}/g, '')
  const inlineCommands =
    /\\(documentclass|usepackage|pagestyle|setlength|geometry|fancyhf|renewcommand|newcommand|title|author|date|maketitle|linespread|onehalfspacing|pgfplotsset|usetikzlibrary|newfontfamily|setmainlanguage|setotherlanguage)\b[^\n]*/g
  result = result.replace(inlineCommands, '')
  // Strip LaTeX comments (lines starting with % or inline % comments)
  result = result
    .split('\n')
    .map((line) => {
      // Remove full-line comments
      if (/^\s*%/.test(line)) return ''
      // Remove inline comments (but not escaped \%)
      return line.replace(/(?<!\\)%.*$/, '')
    })
    .join('\n')
  return result
}

/** Convert sectioning commands to markdown headings */
function convertSections(text: string): string {
  return text
    .replace(/\\section\*?\{([^}]+)\}/g, '\n## $1\n')
    .replace(/\\subsection\*?\{([^}]+)\}/g, '\n### $1\n')
    .replace(/\\subsubsection\*?\{([^}]+)\}/g, '\n#### $1\n')
    .replace(/\\paragraph\{([^}]+)\}/g, '\n**$1** ')
}

/** Regex fragment matching brace content with one level of nesting */
const BRACE_CONTENT = '([^{}]*(?:\\{[^}]*\\}[^{}]*)*)'

/** Convert text formatting commands (supports one level of nested braces) */
function convertFormatting(text: string): string {
  const bf = new RegExp(`\\\\textbf\\{${BRACE_CONTENT}\\}`, 'g')
  const it = new RegExp(`\\\\textit\\{${BRACE_CONTENT}\\}`, 'g')
  const ul = new RegExp(`\\\\underline\\{${BRACE_CONTENT}\\}`, 'g')
  const em = new RegExp(`\\\\emph\\{${BRACE_CONTENT}\\}`, 'g')
  const tx = new RegExp(`\\\\text\\{${BRACE_CONTENT}\\}`, 'g')
  return text
    .replace(bf, '**$1**')
    .replace(it, '*$1*')
    .replace(ul, '$1')
    .replace(em, '*$1*')
    .replace(tx, '$1')
}

/** Convert enumerate with label support to markdown numbered lists */
function convertLists(text: string): string {
  let result = text

  // Convert enumerate with [label=\alph*] style to lettered items
  // Process each enumerate block to assign proper labels
  result = result.replace(
    /\\begin\{enumerate\}\s*\[([^\]]*)\]([\s\S]*?)\\end\{enumerate\}/g,
    (_match, options: string, body: string) => {
      const startMatch = /start=(\d+)/.exec(options)
      const startIdx = startMatch ? parseInt(startMatch[1], 10) : 1
      const isAlpha = /\\alph/.test(options)

      let itemIdx = 0
      return body.replace(/\\item\s*/g, () => {
        const idx = startIdx + itemIdx
        itemIdx++
        const label = isAlpha ? String.fromCharCode(96 + idx) : String(idx)
        return `\n${label}. `
      })
    },
  )

  // Plain enumerate/itemize without options
  result = result.replace(/\\begin\{itemize\}/g, '')
  result = result.replace(/\\end\{itemize\}/g, '')
  result = result.replace(/\\begin\{enumerate\}(\[[^\]]*\])?/g, '')
  result = result.replace(/\\end\{enumerate\}/g, '')
  result = result.replace(/\\item\s*/g, '\n- ')
  return result
}

/** Convert exam-style question/choices patterns */
function convertExamPatterns(text: string): string {
  let result = text
  result = result.replace(/\\begin\{questions\}/g, '')
  result = result.replace(/\\end\{questions\}/g, '')
  result = result.replace(/\\question\s*/g, '\n**Question:** ')
  result = result.replace(/\\begin\{choices\}/g, '')
  result = result.replace(/\\end\{choices\}/g, '')
  result = result.replace(/\\choice\s*/g, '\n- ')
  result = result.replace(/\\CorrectChoice\s*/g, '\n- ')
  return result
}

/** Convert \begin{tabular}{|c|c|c|} ... \end{tabular} to markdown tables */
function convertTables(text: string): string {
  return text.replace(
    /\\begin\{tabular\*?\}\s*\{[^}]*\}([\s\S]*?)\\end\{tabular\*?\}/g,
    (_match, body: string) => {
      // Remove \hline and split on \\
      const cleaned = body.replace(/\\hline/g, '').trim()
      const rows = cleaned
        .split(/\\\\/)
        .map((row) => row.trim())
        .filter(Boolean)

      if (rows.length === 0) return ''

      const parseRow = (row: string) =>
        row.split('&').map((cell) =>
          cell
            .replace(/\\textbf\{([^}]*)\}/g, '**$1**')
            .replace(/\\textit\{([^}]*)\}/g, '*$1*')
            .trim(),
        )

      const headerCells = parseRow(rows[0])
      const mdLines = [
        `| ${headerCells.join(' | ')} |`,
        `| ${headerCells.map(() => '---').join(' | ')} |`,
      ]

      for (let i = 1; i < rows.length; i++) {
        const cells = parseRow(rows[i])
        mdLines.push(`| ${cells.join(' | ')} |`)
      }

      return '\n' + mdLines.join('\n') + '\n'
    },
  )
}

/** Strip minipage environments — keep inner content */
function stripMinipages(text: string): string {
  let result = text
  result = result.replace(/\\begin\{minipage\}(\[[^\]]*\])?\{[^}]*\}/g, '')
  result = result.replace(/\\end\{minipage\}/g, '')
  return result
}

/**
 * Extract TikZ picture blocks and parse them into renderable diagram specs.
 * Replaces each tikzpicture in the text with a unique marker for later injection.
 */
function extractTikzDiagrams(text: string): { text: string; diagrams: ParsedDiagram[] } {
  const diagrams: ParsedDiagram[] = []
  let diagramIdx = 0

  const processed = text.replace(
    /\\begin\{tikzpicture\}([\s\S]*?)\\end\{tikzpicture\}/g,
    (fullMatch) => {
      // Try axis parser first
      if (hasTikzAxis(fullMatch)) {
        const block = parseTikzAxis(fullMatch)
        if (block) {
          const id = `tikz-diagram-${diagramIdx++}`
          diagrams.push({ type: 'axis', id, spec: block.axis })
          return `\n\n${DIAGRAM_MARKER}${diagrams.length - 1}%%%\n\n`
        }
      }

      // Try \draw ... plot parser
      if (hasTikzDrawPlot(fullMatch)) {
        const block = parseTikzDrawPlot(fullMatch)
        if (block) {
          const id = `tikz-diagram-${diagramIdx++}`
          diagrams.push({ type: 'axis', id, spec: block.axis })
          return `\n\n${DIAGRAM_MARKER}${diagrams.length - 1}%%%\n\n`
        }
      }

      // Try geometry parser
      if (hasTikzGeometry(fullMatch)) {
        const block = parseTikzGeometry(fullMatch)
        if (block) {
          const id = `tikz-diagram-${diagramIdx++}`
          diagrams.push({ type: 'geometry', id, spec: block.geometry })
          return `\n\n${DIAGRAM_MARKER}${diagrams.length - 1}%%%\n\n`
        }
      }

      // Fallback: show text placeholder for unparseable tikzpictures
      return '\n\n> **[Diagram]**\n\n'
    },
  )

  return { text: processed, diagrams }
}

/** Strip language/polyglossia commands */
function stripLanguageCommands(text: string): string {
  let result = text
  result = result.replace(/\\selectlanguage\{[^}]*\}/g, '')
  result = result.replace(/\\begin\{(english|hebrew|arabic)\}/g, '')
  result = result.replace(/\\end\{(english|hebrew|arabic)\}/g, '')
  result = result.replace(/\\(begingroup|endgroup)/g, '')
  return result
}

/** Strip \begin{center}...\end{center} but keep content */
function stripCenterEnv(text: string): string {
  return text.replace(/\\begin\{center\}/g, '').replace(/\\end\{center\}/g, '')
}

/**
 * Apply a replacement only to text segments outside $ and $$ math delimiters.
 * Math segments are passed through unchanged.
 */
function replaceOutsideMath(text: string, pattern: RegExp, replacement: string): string {
  // Split on math delimiters, preserving them
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$]+?\$)/g)
  return parts
    .map((part, i) => {
      // Odd indices are math segments (captured groups)
      if (i % 2 === 1) return part
      return part.replace(pattern, replacement)
    })
    .join('')
}

/** Clean up spacing and misc commands */
function cleanMisc(text: string): string {
  let result = text
    // Line breaks: \\ optionally followed by spacing like [0.2cm]
    .replace(/\\\\(?:\[[\d.]+(?:em|pt|mm|cm|ex)\])?/g, '\n\n')
    .replace(/\\(?:hspace|vspace)\*?\{[^}]+\}/g, ' ')
    .replace(
      /\\(?:hfill|vfill|noindent|clearpage|newpage|bigskip|medskip|smallskip|LARGE|Large|large|normalsize)/g,
      '',
    )
    .replace(/\\label\{[^}]+\}/g, '')
    .replace(/\\ref\{[^}]+\}/g, '(ref)')
    .replace(/\\arraystretch/g, '')
    // Strip \displaystyle (used in math mode for display sizing)
    .replace(/\\displaystyle\s*/g, '')
    // Strip \measuredangle (replace with angle symbol)
    .replace(/\\measuredangle/g, '∠')
    // Strip \implies → ⇒
    .replace(/\\implies/g, '⇒')
    // Strip orphaned \closedcycle and \tkz commands
    .replace(/\\closedcycle/g, '')
    .replace(/\\tkz\w+(?:\[[^\]]*\])?(?:\([^)]*\))?/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  // Replace \% → % only outside math (KaTeX handles \% natively inside math)
  result = replaceOutsideMath(result, /\\%/g, '%')

  return result
}

/**
 * Detects text direction from LaTeX source.
 * Returns 'rtl' for Hebrew/Arabic documents, 'ltr' otherwise.
 */
export function detectDirection(latex: string): 'ltr' | 'rtl' {
  if (/\\setmainlanguage\{hebrew\}/.test(latex)) return 'rtl'
  if (/\\setmainlanguage\{arabic\}/.test(latex)) return 'rtl'
  if (/\\usepackage(\[.*?\])?\{(.*?bidi.*?)\}/.test(latex)) return 'rtl'
  // Check for significant Hebrew character content
  const hebrewChars = latex.match(/[\u0590-\u05FF]/g)
  if (hebrewChars && hebrewChars.length > 20) return 'rtl'
  return 'ltr'
}

/** Result of converting LaTeX to markdown with extracted diagrams */
export interface LatexToMarkdownResult {
  /** Markdown segments split around diagram markers */
  segments: string[]
  /** Parsed diagram specs corresponding to the gaps between segments */
  diagrams: ParsedDiagram[]
}

/**
 * Converts raw LaTeX source to markdown segments with parsed TikZ diagram specs.
 *
 * Returns an interleaved structure:
 * - segments[0], diagrams[0], segments[1], diagrams[1], ..., segments[N]
 *
 * Each segment is a markdown string renderable via MathMarkdown.
 * Each diagram is a parsed spec renderable via AxisRenderer or GeometryRenderer.
 */
export function latexToMarkdownWithDiagrams(latex: string): LatexToMarkdownResult {
  let result = stripPreamble(latex)
  const { text: withMarkers, diagrams } = extractTikzDiagrams(result)
  result = withMarkers
  result = convertTables(result)
  result = stripMinipages(result)
  result = stripCenterEnv(result)
  result = stripLanguageCommands(result)
  result = convertSections(result)
  result = convertFormatting(result)
  result = convertLists(result)
  result = convertExamPatterns(result)
  // Strip leading whitespace from lines to prevent markdown code block rendering
  // (4+ spaces at line start = code block in markdown)
  result = result
    .split('\n')
    .map((line) => line.trimStart())
    .join('\n')
  result = cleanMisc(result)

  // Split on diagram markers to create interleaved segments
  if (diagrams.length === 0) {
    return { segments: [result], diagrams: [] }
  }

  const segments: string[] = []
  let remaining = result
  for (let i = 0; i < diagrams.length; i++) {
    const marker = `${DIAGRAM_MARKER}${i}%%%`
    const markerIdx = remaining.indexOf(marker)
    if (markerIdx !== -1) {
      segments.push(remaining.slice(0, markerIdx).trim())
      remaining = remaining.slice(markerIdx + marker.length)
    } else {
      // Marker not found (shouldn't happen) — push empty segment
      segments.push('')
    }
  }
  segments.push(remaining.trim())

  return { segments, diagrams }
}

/**
 * Converts raw LaTeX source to markdown with math delimiters preserved.
 * The output is suitable for rendering via MathMarkdown (remark-math + rehype-katex).
 *
 * @deprecated Use latexToMarkdownWithDiagrams() for proper diagram rendering.
 *             This function still shows text placeholders for TikZ diagrams.
 */
export function latexToMarkdown(latex: string): string {
  const { segments, diagrams } = latexToMarkdownWithDiagrams(latex)
  if (diagrams.length === 0) return segments[0]

  // Fallback: join with text placeholders for backward compatibility
  const parts: string[] = []
  for (let i = 0; i < diagrams.length; i++) {
    parts.push(segments[i])
    const d = diagrams[i]
    if (d.type === 'axis') {
      parts.push('\n\n> **[Graph/Axis diagram]**\n\n')
    } else {
      parts.push('\n\n> **[Geometry diagram]**\n\n')
    }
  }
  parts.push(segments[segments.length - 1])
  return parts.join('')
}
