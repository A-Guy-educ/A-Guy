/**
 * Normalizes LaTeX delimiters and escaping for remark-math compatibility.
 *
 * remark-math only recognizes $...$ and $$...$$ delimiters.
 * LLMs often output \[...\] and \(...\) with various escape levels.
 *
 * Handles:
 * - Single/double/triple backslash delimiters: \[, \\[, \\\[ → $$
 * - Bare brackets with LaTeX: [ \frac{a}{b} ] → $$...$$ (detected by LaTeX command presence)
 * - Undelimited LaTeX: \frac{a}{b} outside of $ → wrapped in $...$
 * - Over-escaped LaTeX commands: \\frac → \frac
 * - Escaped equals: \= → =
 *
 * Conversions:
 * - \[...\], \\[...\\], \\\[...\\\] → $$...$$ (block/display math)
 * - \(...\), \\(...\\), \\\(...\\\) → $...$ (inline math, preserves sentence flow)
 * - \\frac, \\sigma, etc. → \frac, \sigma (normalize commands)
 * - Bare LaTeX commands → wrapped in $...$ (safety net for LLM output)
 */
export function normalizeLatexDelimiters(content: string): string {
  if (!content) return content

  // Collapse deep indentation (4+ spaces) to 2 spaces.
  // CommonMark treats 4+ space-indented lines as <pre><code> blocks,
  // inside which remark-math won't detect $...$ or $$...$$ delimiters.
  // LLMs often use deep indentation for nested list content, so we flatten it.
  let result = content
    .replace(/^ {4,}/gm, '  ')
    // Pre-process: detect bare brackets containing LaTeX commands
    // Closed: [ \frac{a}{b} ] → \[ \frac{a}{b} \] (but not markdown links [text](url))
    // Lookbehinds: (?<!\\) excludes \[ display math, (?<![a-zA-Z]) excludes \left[, \right[, \bigl[, etc.
    .replace(/(?<!\\)(?<![a-zA-Z])\[([^\]]*\\[a-zA-Z]+[^\]]*)\](?!\()/g, '\\[$1\\]')
    // Unclosed (no closing ]): [ \frac{a}{b} (end of line) → \[ \frac{a}{b} \]
    .replace(/(?<!\\)(?<![a-zA-Z])\[([^\]\n]*\\[a-zA-Z]+[^\]\n]*)$/gm, '\\[$1\\]')
    // Convert matched block math delimiter pairs: \[...\] → $$...$$ (with newlines for remark-math)
    // Matches pairs to avoid creating unmatched $$ during streaming when only \[ has arrived.
    .replace(/\\{1,3}\[([\s\S]*?)\\{1,3}\]/g, (_, expr) => `\n$$\n${expr}\n$$\n`)
    // Convert matched inline math delimiter pairs: \(...\) → $...$ (preserves inline flow)
    // Matches pairs to avoid creating unmatched $ during streaming when only \( has arrived.
    .replace(/\\{1,3}\(([\s\S]*?)\\{1,3}\)/g, (_, expr) => `$${expr}$`)
    // Normalize over-escaped LaTeX commands: \\frac → \frac, \\sigma → \sigma
    .replace(/\\\\([a-zA-Z])/g, '\\$1')
    // Remove escaped equals: \= → =
    .replace(/\\=/g, '=')

  // Ensure $$ block math delimiters are on their own lines (required by remark-math).
  // LLMs sometimes output $$...$$ inline with text, which breaks block math detection.
  // Match complete $$...$$ pairs and ensure newlines around them.
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_, expr) => `\n$$\n${expr.trim()}\n$$\n`)

  // Trim spaces inside inline $...$ delimiters (e.g. $ x $ → $x$).
  // LLMs often output $ \mu $ with spaces, but remark-math requires tight delimiters
  // (no space after opening $ or before closing $) to recognize inline math.
  // The lookbehind ensures we only match opening $ (preceded by whitespace, start, or
  // non-ASCII chars like Hebrew), not the closing $ of a previous expression
  // (e.g. $x$ and $\mu$ stays intact because the middle $ follows ASCII letter 'x').
  result = result.replace(/(?<=\s|^|[^\x00-\x7F])\$\s+([^$\n]+?)\s+\$/g, (_, expr) => `$${expr}$`)

  // Escape mismatched $ pairs that contain Hebrew text (RTL chars).
  // When the LLM misuses $ delimiters, remarkMath may pair them incorrectly,
  // creating expressions that contain Hebrew text. KaTeX can't parse Hebrew,
  // so it shows red error text. This step finds $...$ pairs with Hebrew inside
  // and escapes the $ so they render as plain text instead of broken math.
  result = escapeMismatchedDollarSigns(result)

  // Ensure spaces around inline $...$ when adjacent to non-ASCII characters (e.g. Hebrew).
  // remarkMath requires certain boundary conditions around $ delimiters — Hebrew characters
  // directly touching $ (like "ההיקף$s$של") prevent detection. Adding spaces fixes this.
  // Only targets non-ASCII characters (Hebrew, Arabic, etc.) adjacent to $.
  result = result
    .replace(/([\u0590-\u05FF\uFB1D-\uFB4F\u0600-\u06FF])(\$[^$\n]+?\$)/g, '$1 $2')
    .replace(/(\$[^$\n]+?\$)([\u0590-\u05FF\uFB1D-\uFB4F\u0600-\u06FF])/g, '$1 $2')

  // Safety net: wrap undelimited LaTeX commands in $...$
  // Matches sequences starting with a known LaTeX command that aren't already inside $ delimiters.
  // Works by splitting on existing $/$$ regions and only processing non-math segments.
  result = wrapUndelimitedLatex(result)

  return result
}

/**
 * Hebrew character range for detecting mismatched $ delimiters.
 * Matches any Hebrew letter (U+0590–U+05FF) or Hebrew presentation form (U+FB1D–U+FB4F).
 */
const HEBREW_REGEX = /[\u0590-\u05FF\uFB1D-\uFB4F]/

/**
 * Maximum length for a legitimate inline math expression.
 * Inline math like $\frac{a}{b}$ is typically short. Expressions longer than
 * this are almost certainly mismatched delimiter pairs spanning across text.
 */
const MAX_INLINE_MATH_LENGTH = 150

/**
 * Escapes $ signs that are part of mismatched pairs.
 *
 * When the LLM outputs many $...$ expressions, remarkMath may pair the wrong
 * opening $ with the wrong closing $, creating a huge "expression" that contains
 * text, Hebrew, or other $ signs. KaTeX can't parse these, producing red error text.
 *
 * This function detects mismatched pairs by checking for:
 * 1. Hebrew characters inside (Hebrew is never valid in LaTeX)
 * 2. Excessive length (real inline math is short)
 * 3. Multiple spaces suggesting natural language, not math
 */
function escapeMismatchedDollarSigns(content: string): string {
  // Match $...$ pairs (not $$) — non-greedy, single line only
  return content.replace(/\$([^$\n]+?)\$/g, (match, inner: string) => {
    // Hebrew text inside → not valid math
    if (HEBREW_REGEX.test(inner)) {
      return `\\$${inner}\\$`
    }
    // Too long for inline math → likely mismatched delimiters
    if (inner.length > MAX_INLINE_MATH_LENGTH) {
      return `\\$${inner}\\$`
    }
    // Contains 3+ consecutive word characters separated by spaces → natural language, not math
    // (math has commands like \frac, symbols, but not "word word word")
    if (/[a-zA-Z]{3,}\s+[a-zA-Z]{3,}\s+[a-zA-Z]{3,}/.test(inner)) {
      return `\\$${inner}\\$`
    }
    return match
  })
}

/**
 * Finds LaTeX commands outside of existing $...$ or $$...$$ regions and wraps them in $...$.
 *
 * Strategy: split content into math and non-math segments, then only process non-math segments
 * to find and wrap bare LaTeX expressions.
 */
function wrapUndelimitedLatex(content: string): string {
  // Split content into segments: math regions (inside $/$$ delimiters) and text regions
  // Match $$...$$, $...$ (non-greedy), preserving them as-is
  const segments = content.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g)

  return segments
    .map((segment, i) => {
      // Odd indices are the captured math regions — leave them untouched
      if (i % 2 === 1) return segment

      // Even indices are non-math text — look for bare LaTeX commands
      return wrapBareLatexInSegment(segment)
    })
    .join('')
}

/**
 * Wraps bare LaTeX command sequences found in a non-math text segment.
 *
 * Matches a LaTeX command followed by its arguments (braces, subscripts, superscripts)
 * and wraps the entire expression in $...$.
 */
function wrapBareLatexInSegment(segment: string): string {
  // Match a LaTeX command followed by optional arguments: braces {}, subscript _, superscript ^
  // The pattern captures the full math expression including nested braces
  // Negative lookbehind for $ ensures we don't match already-delimited content
  //
  // Structure: \command + (brace args | subscript/superscript)*
  // - \{[^}]*\} matches brace arguments like {a}, {CD}, {\\triangle ABC}
  // - [_^](?:\{[^}]*\}|[^\s{},]) matches subscript/superscript with optional brace group
  return segment.replace(
    /(?<!\$)(?<![a-zA-Z])(\\(?:frac|sqrt|sum|prod|int|lim|sin|cos|tan|log|ln|exp|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|omega|phi|psi|triangle|angle|cdot|times|div|pm|mp|leq|geq|neq|approx|infty|partial|nabla|forall|exists|in|subset|supset|cup|cap|vec|hat|bar|dot|tilde|overline|underline|text|mathrm|mathbf|mathit|binom|dbinom|tbinom)(?:\{[^}]*\}|[_^](?:\{[^}]*\}|[^\s{},]))*)/g,
    (match) => `$${match}$`,
  )
}
