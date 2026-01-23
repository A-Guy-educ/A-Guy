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
