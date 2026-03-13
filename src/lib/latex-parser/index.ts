import type { ParseResult, ParseWarning } from '@/lib/latex-parser/types'
import { sanitizeLatex } from '@/lib/latex-parser/sanitizer'
import { tokenize } from '@/lib/latex-parser/tokenizer'
import { parseExamClsMcq } from '@/lib/latex-parser/mcq-exam-cls'
import { parseEnumitemMcq } from '@/lib/latex-parser/mcq-enumitem'
import { parseInlineMcq } from '@/lib/latex-parser/mcq-inline'
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
])

/**
 * Processes a list of tokens into ContentBlocks.
 * Extracted so it can recurse for `document` and `questions` environments.
 */
function processTokens(
  tokens: import('@/lib/latex-parser/types').LatexToken[],
  blocks: ContentBlock[],
  warnings: ParseWarning[],
): void {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token.type === 'environment') {
      const envName = token.name ?? ''

      if (envName === 'document') {
        // Pass-through: process children as top-level tokens
        if (token.children?.length) {
          processTokens(token.children, blocks, warnings)
        }
      } else if (envName === 'questions') {
        // Extract inner content (strip \begin{envName} and \end{envName} tags)
        const inner = extractInner(token)
        processQuestionsEnv(inner, blocks, warnings, token.line)
      } else {
        const inner = extractInner(token)
        const mcq = tryMcqMatchers(inner)
        if (mcq) {
          blocks.push(mcq)
        } else {
          blocks.push(makeRichTextBlock(inner || token.value))
          warnings.push({
            line: token.line,
            message: `Unrecognized environment: ${envName}`,
            rawLatex: token.value,
          })
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
      if (PREAMBLE_COMMANDS.has(cmdName)) {
        // Skip preamble commands that leaked through
      } else if (cmdName === 'section') {
        const titleMatch = /\\section\{([^}]*)\}/.exec(token.value)
        const title = titleMatch ? titleMatch[1] : token.value
        blocks.push(makeRichTextBlock(`## ${title}`))
      } else if (cmdName === 'question') {
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
    } else if (token.type === 'text') {
      const text = token.value.trim()
      if (text) {
        blocks.push(makeRichTextBlock(text))
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

  const sanitized = sanitizeLatex(latex)
  if (!sanitized.safe) {
    const violations = sanitized.violations.map((v) => v.command).join(', ')
    return {
      blocks: [],
      warnings: [],
      errors: [
        {
          line: sanitized.violations[0]?.line ?? 1,
          message: `Dangerous LaTeX commands detected: ${violations}`,
          rawLatex: latex,
        },
      ],
    }
  }

  // Strip preamble before \begin{document} to avoid orphan text tokens
  let source = latex
  const beginDocIdx = source.indexOf('\\begin{document}')
  if (beginDocIdx !== -1) {
    source = source.slice(beginDocIdx)
  }

  const tokens = tokenize(source)
  processTokens(tokens, blocks, warnings)

  return { blocks, warnings, errors: [] }
}
