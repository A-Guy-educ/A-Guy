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

  // Use a function replacer to avoid $$ special replacement pattern issues
  let result = content
    // Pre-process: detect bare brackets containing LaTeX commands
    // Closed: [ \frac{a}{b} ] → \[ \frac{a}{b} \] (but not markdown links [text](url))
    // Use negative lookbehind (?<!\\) to avoid matching already-escaped \[ or \\[
    .replace(/(?<!\\)\[([^\]]*\\[a-zA-Z]+[^\]]*)\](?!\()/g, '\\[$1\\]')
    // Unclosed (no closing ]): [ \frac{a}{b} (end of line) → \[ \frac{a}{b} \]
    .replace(/(?<!\\)\[([^\]\n]*\\[a-zA-Z]+[^\]\n]*)$/gm, '\\[$1\\]')
    // Convert block math delimiters: \\\[, \\[, \[ → $$ (with newline for remark-math)
    .replace(/\\{1,3}\[/g, () => '\n$$\n')
    .replace(/\\{1,3}\]/g, () => '\n$$\n')
    // Convert inline math delimiters: \\\(, \\(, \( → $ (preserves inline flow)
    .replace(/\\{1,3}\(/g, () => '$')
    .replace(/\\{1,3}\)/g, () => '$')
    // Normalize over-escaped LaTeX commands: \\frac → \frac, \\sigma → \sigma
    .replace(/\\\\([a-zA-Z])/g, '\\$1')
    // Remove escaped equals: \= → =
    .replace(/\\=/g, '=')

  // Safety net: wrap undelimited LaTeX commands in $...$
  // Matches sequences starting with a known LaTeX command that aren't already inside $ delimiters.
  // Works by splitting on existing $/$$ regions and only processing non-math segments.
  result = wrapUndelimitedLatex(result)

  return result
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
