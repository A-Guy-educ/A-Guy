/**
 * LaTeX Validation Utilities
 *
 * Validates extracted LaTeX text for structural correctness
 * before storing in ContextExtractions.
 *
 * @fileType utility
 * @domain conversion
 * @pattern validation
 */

import { sanitizeLatex } from '@/lib/latex-parser/sanitizer'

export interface LatexValidationResult {
  valid: boolean
  warnings: string[]
  errors: string[]
  sanitizedText: string
  isTruncated: boolean
}

/**
 * Validate extracted LaTeX text for structural correctness.
 *
 * Checks:
 * - Non-empty content
 * - Dangerous commands (via sanitizer)
 * - Balanced braces {}
 * - Balanced \begin{}/\end{} pairs
 * - Truncation indicators
 */
export function validateExtractedLatex(text: string): LatexValidationResult {
  const warnings: string[] = []
  const errors: string[] = []
  const trimmed = text.trim()

  if (!trimmed) {
    return {
      valid: false,
      warnings,
      errors: ['Empty LaTeX output'],
      sanitizedText: '',
      isTruncated: false,
    }
  }

  // Check for dangerous commands
  const sanitizeResult = sanitizeLatex(trimmed)
  if (!sanitizeResult.safe) {
    const cmds = sanitizeResult.violations.map((v) => `${v.command} (line ${v.line})`)
    errors.push(`Dangerous commands found: ${cmds.join(', ')}`)
  }

  // Check balanced braces
  const braceBalance = countBraceBalance(trimmed)
  if (braceBalance !== 0) {
    warnings.push(
      `Unbalanced braces: ${braceBalance > 0 ? braceBalance + ' unclosed {' : Math.abs(braceBalance) + ' extra }'}`,
    )
  }

  // Check balanced \begin{}/\end{} pairs
  const envIssues = checkEnvironmentBalance(trimmed)
  if (envIssues.length > 0) {
    for (const issue of envIssues) {
      warnings.push(issue)
    }
  }

  // Check for truncation
  const isTruncated = detectTruncation(trimmed, braceBalance, envIssues)
  if (isTruncated) {
    warnings.push('Output appears truncated')
  }

  // Normalize fonts for Overleaf compatibility
  const normalized = normalizeHebrewFonts(trimmed)
  if (normalized !== trimmed) {
    warnings.push('Replaced non-standard Hebrew fonts with Overleaf-compatible alternatives')
  }

  const valid = errors.length === 0
  return { valid, warnings, errors, sanitizedText: normalized, isTruncated }
}

/**
 * Count brace balance. Returns 0 if balanced, positive if unclosed {, negative if extra }.
 * Ignores escaped braces (\{ and \}).
 */
function countBraceBalance(text: string): number {
  let balance = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\') {
      i++ // skip escaped character
      continue
    }
    if (text[i] === '{') balance++
    if (text[i] === '}') balance--
  }
  return balance
}

/**
 * Check that every \begin{env} has a matching \end{env}.
 * Returns list of issue descriptions.
 */
function checkEnvironmentBalance(text: string): string[] {
  const issues: string[] = []
  const beginRegex = /\\begin\{([^}]+)\}/g
  const endRegex = /\\end\{([^}]+)\}/g

  const envCounts = new Map<string, number>()

  let match
  while ((match = beginRegex.exec(text)) !== null) {
    const env = match[1]
    envCounts.set(env, (envCounts.get(env) || 0) + 1)
  }
  while ((match = endRegex.exec(text)) !== null) {
    const env = match[1]
    envCounts.set(env, (envCounts.get(env) || 0) - 1)
  }

  for (const [env, count] of envCounts) {
    if (count > 0) {
      issues.push(`\\begin{${env}} without matching \\end{${env}} (${count} unclosed)`)
    } else if (count < 0) {
      issues.push(`\\end{${env}} without matching \\begin{${env}} (${Math.abs(count)} extra)`)
    }
  }

  return issues
}

/**
 * Detect if the output was likely truncated mid-generation.
 */
function detectTruncation(text: string, braceBalance: number, envIssues: string[]): boolean {
  // Unmatched \begin without \end suggests truncation
  const hasUnclosedEnv = envIssues.some((issue) => issue.includes('without matching \\end'))
  if (hasUnclosedEnv) return true

  // Significant unclosed braces suggest truncation
  if (braceBalance >= 3) return true

  // Text ends with a trailing backslash (mid-command)
  if (text.endsWith('\\')) return true

  // Text ends mid-word after a backslash command (e.g., "\fra")
  const lastLine = text.split('\n').pop()?.trim() || ''
  if (/\\[a-zA-Z]+$/.test(lastLine) && !lastLine.endsWith('}')) {
    // Could be a valid command at end of line, only flag if also has brace issues
    if (braceBalance > 0) return true
  }

  // Content-level check: exercises with empty solution stubs suggest the LLM
  // ran out of tokens and wrapped up early with a valid \end{document}
  if (hasEmptySolutionStubs(text)) return true

  return false
}

/**
 * Replace non-standard Hebrew fonts (David CLM, Miriam CLM, etc.) with
 * universally available alternatives that work on Overleaf without manual
 * font uploads. FreeSerif/FreeSans/FreeMono are pre-installed on TeX Live
 * and support Hebrew glyphs.
 */
function normalizeHebrewFonts(text: string): string {
  // Map non-standard fonts to universally available alternatives
  const fontReplacements: Array<[RegExp, string]> = [
    [/David CLM/g, 'FreeSerif'],
    [/Miriam Mono CLM/g, 'FreeMono'],
    [/Miriam CLM/g, 'FreeSans'],
    [/Hadasim CLM/g, 'FreeSerif'],
    [/Nachlieli CLM/g, 'FreeSans'],
    [/Frank Ruehl CLM/g, 'FreeSerif'],
  ]

  let result = text
  for (const [pattern, replacement] of fontReplacements) {
    result = result.replace(pattern, replacement)
  }
  return result
}

/**
 * Detect when the LLM generated exercise headers but left solutions empty.
 * This happens when the LLM runs out of output tokens but still produces
 * a structurally valid document (with \end{document}).
 */
function hasEmptySolutionStubs(text: string): boolean {
  // Find all solution section headers
  const solutionHeaders = text.match(/\\section\*\{פתרון תרגיל \d+\}/g)
  if (!solutionHeaders || solutionHeaders.length === 0) return false

  // Check if any solution section is empty (just a header with no content before the next header or end)
  for (const header of solutionHeaders) {
    const headerIndex = text.indexOf(header)
    const afterHeader = text.substring(headerIndex + header.length).trim()

    // Find what comes next: another \section*, \end{document}, or content
    const nextSectionMatch = afterHeader.match(/^[\s\n]*(\\section\*|\\end\{document\})/)
    if (nextSectionMatch) return true
  }

  return false
}
