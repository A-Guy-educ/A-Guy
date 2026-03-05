/**
 * Normalizes LaTeX delimiters and escaping for remark-math compatibility.
 *
 * remark-math only recognizes $...$ and $$...$$ delimiters.
 * LLMs often output \[...\] and \(...\) with various escape levels.
 *
 * All math expressions are converted to block/display math ($$...$$) to ensure
 * they appear on their own line, separate from text.
 *
 * Handles:
 * - Single/double/triple backslash delimiters: \[, \\[, \\\[ → $$
 * - Bare brackets with LaTeX: [ \frac{a}{b} ] → $$...$$ (detected by LaTeX command presence)
 * - Over-escaped LaTeX commands: \\frac → \frac
 * - Escaped equals: \= → =
 *
 * Conversions:
 * - \[...\], \\[...\\], \\\[...\\\] → $$...$$ (block/display math)
 * - \(...\), \\(...\\), \\\(...\\\) → $$...$$ (converted to block math)
 * - \\frac, \\sigma, etc. → \frac, \sigma (normalize commands)
 */
export function normalizeLatexDelimiters(content: string): string {
  if (!content) return content

  // Use a function replacer to avoid $$ special replacement pattern issues
  return (
    content
      // Pre-process: detect bare brackets containing LaTeX commands
      // Closed: [ \frac{a}{b} ] → \[ \frac{a}{b} \] (but not markdown links [text](url))
      // Use negative lookbehind (?<!\\) to avoid matching already-escaped \[ or \\[
      .replace(/(?<!\\)\[([^\]]*\\[a-zA-Z]+[^\]]*)\](?!\()/g, '\\[$1\\]')
      // Unclosed (no closing ]): [ \frac{a}{b} (end of line) → \[ \frac{a}{b} \]
      .replace(/(?<!\\)\[([^\]\n]*\\[a-zA-Z]+[^\]\n]*)$/gm, '\\[$1\\]')
      // Convert block math delimiters: \\\[, \\[, \[ → $$ (with newline for remark-math)
      .replace(/\\{1,3}\[/g, () => '\n$$\n')
      .replace(/\\{1,3}\]/g, () => '\n$$\n')
      // Convert inline math delimiters to block math: \\\(, \\(, \( → $$ (all math on own line)
      .replace(/\\{1,3}\(/g, () => '\n$$\n')
      .replace(/\\{1,3}\)/g, () => '\n$$\n')
      // Normalize over-escaped LaTeX commands: \\frac → \frac, \\sigma → \sigma
      .replace(/\\\\([a-zA-Z])/g, '\\$1')
      // Remove escaped equals: \= → =
      .replace(/\\=/g, '=')
  )
}
