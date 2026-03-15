import type { ParseResult, ParseWarning } from '@/lib/latex-parser/types'
import type { LatexToken } from '@/lib/latex-parser/types'
import { sanitizeLatex } from '@/lib/latex-parser/sanitizer'
import { tokenize } from '@/lib/latex-parser/tokenizer'
import { parseExamClsMcq } from '@/lib/latex-parser/mcq-exam-cls'
import { parseEnumitemMcq } from '@/lib/latex-parser/mcq-enumitem'
import { parseInlineMcq } from '@/lib/latex-parser/mcq-inline'
import { parseEnumerate, isSolutionHeader, isExerciseTitle } from '@/lib/latex-parser/enumerate-parser'
import { parseTabular } from '@/lib/latex-parser/tabular-parser'
import { parseTikzAxis, hasTikzAxis } from '@/lib/latex-parser/tikz-axis-parser'
import { parseTikzGeometry, hasTikzGeometry } from '@/lib/latex-parser/tikz-geometry-parser'
import { makeRichTextBlock, makeLatexBlock } from '@/lib/latex-parser/block-generators'
import type { ContentBlock } from '@/server/payload/collections/Exercises/types'

/**
 * Splits the inner text of a `questions` environment on `\question` boundaries,
 * then tries parseExamClsMcq on each chunk (question + following choices env).
 */
function processQuestionsEnv(
  innerText: string,
  blocks: ContentBlock[],
  warnings: ParseWarning[],
  line: number,
): void {
  // Split on \question so each piece starts with the question text + choices block
  const parts = innerText.split(/(?=\\question\s)/)
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue

    const mcq = parseExamClsMcq(trimmed)
    if (mcq) {
      blocks.push(mcq)
    } else if (trimmed.startsWith('\\question')) {
      // Has a question marker but failed to parse — emit as rich_text with warning
      blocks.push(makeRichTextBlock(trimmed))
      warnings.push({ line, message: 'Could not parse question block', rawLatex: trimmed })
    }
    // Non-question preamble text inside questions env is silently skipped
  }
}

/**
 * Tries all MCQ matchers on a text chunk.
 * Returns a parsed block or null.
 */
function tryMcqMatchers(text: string): ContentBlock | null {
  return parseExamClsMcq(text) ?? parseEnumitemMcq(text) ?? parseInlineMcq(text)
}

/** Preamble-only command names that should be silently skipped */
const PREAMBLE_COMMANDS = new Set([
  'documentclass', 'usepackage', 'pagestyle', 'setlength', 'geometry',
  'fancyhf', 'renewcommand', 'newcommand', 'title', 'author', 'date', 'maketitle',
  'linespread', 'newfontfamily', 'setmainlanguage', 'setotherlanguage',
  'usetikzlibrary', 'pgfplotsset', 'onehalfspacing',
])

/** Environments that just wrap content — recurse into children */
const PASSTHROUGH_ENVS = new Set([
  'document', 'minipage', 'center', 'flushleft', 'flushright',
])

/** Layout/formatting commands to silently skip */
const SKIP_COMMANDS = new Set([
  ...PREAMBLE_COMMANDS,
  'noindent', 'vspace', 'hspace', 'hfill', 'vfill',
  'newpage', 'clearpage', 'bigskip', 'medskip', 'smallskip',
  'selectlanguage', 'begingroup', 'endgroup', 'LARGE', 'large',
  'renewcommand', 'arraystretch',
])

/** Clean LaTeX text: strip formatting commands, normalize whitespace */
function cleanText(text: string): string {
  return text
    .replace(/\\textbf\{([^}]*)\}/g, '**$1**')
    .replace(/\\textit\{([^}]*)\}/g, '*$1*')
    .replace(/\\emph\{([^}]*)\}/g, '*$1*')
    .replace(/\\underline\{([^}]*)\}/g, '$1')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\\\/g, '\n')
    .replace(/\\vspace\{[^}]*\}/g, '')
    .replace(/\\hspace\*?\{[^}]*\}/g, ' ')
    .replace(/\\noindent/g, '')
    .replace(/\\selectlanguage\{[^}]*\}/g, '')
    .replace(/\\begingroup/g, '')
    .replace(/\\endgroup/g, '')
    .replace(/\\arraystretch/g, '')
    // Strip leading line-break spacing like [0.2cm], [5mm]
    .replace(/^\s*\[\d+(\.\d+)?(cm|mm|pt|em|ex)\]\s*/g, '')
    .trim()
}

/**
 * Detects LaTeX noise fragments that shouldn't become blocks.
 * These are typically orphaned arguments/options from parsed commands.
 */
function isLatexNoise(text: string): boolean {
  const stripped = text.replace(/\s/g, '')
  // Orphaned option brackets: [0.2cm], [t], [h], [H], [!ht]
  if (/^\[[^\]]*\]$/.test(stripped)) return true
  // Orphaned braces with a number or simple value: {1.5}, {0.55\textwidth}
  if (/^\{[^}]*\}$/.test(stripped)) return true
  // Minipage option fragments: [t]{0.55\textwidth} or [t]{0.45
  if (/^\[[^\]]*\]\{[^}]*\}?$/.test(stripped)) return true
  // Column spec fragments: |c|c|c|
  if (/^\|?[clrp|]+\|?$/.test(stripped)) return true
  // Purely numeric or single special char
  if (/^[\d.]+$/.test(stripped)) return true
  return false
}

/**
 * Processes a list of tokens into ContentBlocks.
 * Handles Bagrut exam format, exam.cls MCQ, and general LaTeX.
 */
function processTokens(
  tokens: LatexToken[],
  blocks: ContentBlock[],
  warnings: ParseWarning[],
): void {
  let inSolutionSection = false

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token.type === 'environment') {
      const envName = token.name ?? ''

      if (PASSTHROUGH_ENVS.has(envName)) {
        if (token.children?.length) {
          processTokens(token.children, blocks, warnings)
        }
      } else if (envName === 'questions') {
        const inner = extractInner(token)
        processQuestionsEnv(inner, blocks, warnings, token.line)
      } else if (envName === 'enumerate') {
        const inner = extractInner(token)
        const enumBlocks = parseEnumerate(inner)
        if (inSolutionSection && enumBlocks.length > 0) {
          // Solution enumerate — attach as fullSolution to previous question blocks
          attachSolutions(blocks, enumBlocks)
        } else {
          blocks.push(...enumBlocks)
        }
      } else if (envName === 'tabular' || envName === 'tabular*') {
        const inner = extractInner(token)
        const table = parseTabular(inner)
        if (table) {
          blocks.push(table)
        }
      } else if (envName === 'tikzpicture') {
        const raw = token.value ?? ''
        if (hasTikzAxis(raw)) {
          const axisBlock = parseTikzAxis(raw)
          if (axisBlock) {
            blocks.push(axisBlock)
          }
        } else if (hasTikzGeometry(raw)) {
          const geoBlock = parseTikzGeometry(raw)
          if (geoBlock) {
            blocks.push(geoBlock)
          }
        }
        // Unrecognized tikzpicture → silently skip (can't render TikZ client-side)
      } else if (envName === 'choices') {
        // Standalone choices env (already handled by questions env processor)
        const inner = extractInner(token)
        const mcq = tryMcqMatchers(inner)
        if (mcq) blocks.push(mcq)
      } else {
        // Unknown environment — try MCQ matchers, then fall back to rich_text
        const inner = extractInner(token)
        const mcq = tryMcqMatchers(inner)
        if (mcq) {
          blocks.push(mcq)
        } else {
          const cleaned = cleanText(inner || token.value)
          if (cleaned) {
            blocks.push(makeRichTextBlock(cleaned))
          }
        }
      }
    } else if (token.type === 'math') {
      const val = token.value
      if (val.startsWith('$$') && val.endsWith('$$')) {
        blocks.push(makeLatexBlock(val.slice(2, -2).trim()))
      } else {
        blocks.push(makeRichTextBlock(val))
      }
    } else if (token.type === 'command') {
      const cmdName = token.name ?? ''
      if (SKIP_COMMANDS.has(cmdName)) {
        // Silently skip
      } else if (cmdName === 'section') {
        const titleMatch = /\\section\*?\{([^}]*)\}/.exec(token.value)
        const title = titleMatch ? titleMatch[1] : token.value
        if (isSolutionHeader(token.value)) {
          inSolutionSection = true
          blocks.push(makeRichTextBlock(`## ${title}`))
        } else {
          inSolutionSection = false
          blocks.push(makeRichTextBlock(`## ${title}`))
        }
      } else if (cmdName === 'textbf') {
        // Check if this is an exercise title like \textbf{תרגיל 1 - Title}
        const exerciseInfo = isExerciseTitle(token.value)
        if (exerciseInfo) {
          inSolutionSection = false
          blocks.push(makeRichTextBlock(`## ${exerciseInfo.title}`))
        } else {
          const cleaned = cleanText(token.value)
          if (cleaned) blocks.push(makeRichTextBlock(cleaned))
        }
      } else if (cmdName === 'question') {
        // Standalone \question (exam.cls) — look ahead for choices env
        const lookahead: string[] = [token.value]
        let j = i + 1
        while (j < tokens.length && tokens[j].name === 'choices') {
          lookahead.push(tokens[j].value)
          j++
        }
        const combined = lookahead.join('\n')
        const mcq = parseExamClsMcq(combined)
        if (mcq) {
          blocks.push(mcq)
          i = j - 1
        } else {
          blocks.push(makeRichTextBlock(token.value))
        }
      }
      // Other commands silently ignored
    } else if (token.type === 'text') {
      const text = cleanText(token.value)
      if (text && text.length > 1 && !isLatexNoise(text)) {
        blocks.push(makeRichTextBlock(text))
      }
    }
  }
}

/**
 * Attaches solution content from solution enumerate blocks to
 * the most recent question_free_response blocks.
 */
function attachSolutions(blocks: ContentBlock[], solutionBlocks: ContentBlock[]): void {
  // Find the last N free_response blocks matching solution count
  const questionBlocks = blocks.filter(
    (b) => b.type === 'question_free_response',
  )
  const startIdx = Math.max(0, questionBlocks.length - solutionBlocks.length)

  for (let i = 0; i < solutionBlocks.length; i++) {
    const target = questionBlocks[startIdx + i]
    const solBlock = solutionBlocks[i]
    if (target && target.type === 'question_free_response' && solBlock.type === 'question_free_response') {
      target.fullSolution = {
        type: 'rich_text',
        format: 'md-math-v1',
        value: solBlock.prompt.value,
        mediaIds: [],
      }
    }
  }
}

/** Extract inner content from an environment token (strip begin/end tags) */
function extractInner(token: import('@/lib/latex-parser/types').LatexToken): string {
  const envName = token.name ?? ''
  const raw = token.value ?? ''
  const beginTag = `\\begin{${envName}}`
  const endTag = `\\end{${envName}}`
  const innerStart = raw.indexOf(beginTag)
  const innerEnd = raw.lastIndexOf(endTag)
  return innerStart !== -1 && innerEnd > innerStart
    ? raw.slice(innerStart + beginTag.length, innerEnd)
    : raw
}

/**
 * Parses a LaTeX string into a list of ContentBlocks.
 *
 * Steps:
 *  1. Return empty on blank input.
 *  2. Sanitize – reject if dangerous commands found.
 *  3. Tokenize into a flat token stream.
 *  4. Map tokens to blocks.
 */
export function parseLatexToBlocks(latex: string): ParseResult {
  const blocks: ContentBlock[] = []
  const warnings: ParseWarning[] = []

  if (!latex.trim()) {
    return { blocks, warnings, errors: [] }
  }

  // Strip preamble before \begin{document} — preamble commands are safe
  let source = latex
  const beginDocIdx = source.indexOf('\\begin{document}')
  if (beginDocIdx !== -1) {
    source = source.slice(beginDocIdx)
  }

  const sanitized = sanitizeLatex(source)
  if (!sanitized.safe) {
    const violations = sanitized.violations.map((v) => v.command).join(', ')
    return {
      blocks: [],
      warnings: [],
      errors: [
        {
          line: sanitized.violations[0]?.line ?? 1,
          message: `Dangerous LaTeX commands detected: ${violations}`,
          rawLatex: source,
        },
      ],
    }
  }

  const tokens = tokenize(source)
  processTokens(tokens, blocks, warnings)

  // Merge consecutive rich_text blocks (inline math splits text into fragments)
  const merged = mergeAdjacentRichText(blocks)

  return { blocks: merged, warnings, errors: [] }
}

/**
 * Merges consecutive rich_text blocks into single blocks.
 * This fixes fragmentation caused by the tokenizer splitting text around inline math.
 */
function mergeAdjacentRichText(blocks: ContentBlock[]): ContentBlock[] {
  const result: ContentBlock[] = []

  for (const block of blocks) {
    const prev = result[result.length - 1]
    if (
      block.type === 'rich_text' &&
      prev?.type === 'rich_text' &&
      !prev.value.startsWith('## ') &&
      !block.value.startsWith('## ')
    ) {
      // Merge into previous rich_text block
      prev.value = `${prev.value} ${block.value}`
    } else {
      result.push(block)
    }
  }

  return result
}
