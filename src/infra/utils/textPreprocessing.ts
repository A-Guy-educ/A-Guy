/**
 * Text preprocessing utilities for rich text rendering
 *
 * @fileType utility
 * @domain shared
 * @pattern markdown-hard-break
 * @ai-summary Converts single newlines to Markdown hard breaks (trailing spaces); preserves existing hard breaks and paragraph breaks untouched.
 */

/**
 * Preprocess text to render single newlines as visible line breaks.
 * Converts single \n to two trailing spaces + \n (Markdown hard break).
 * Preserves existing hard breaks and paragraph breaks.
 *
 * @param text - The input text with newlines
 * @returns Preprocessed text with Markdown hard breaks
 */
export function preprocessNewlines(text: string): string {
  // Strategy: Replace single newlines (not preceded by another newline and not followed by another newline)
  // with two spaces + newline, BUT skip if already has two trailing spaces

  // Split by lines to process each one
  const lines = text.split('\n')
  const result: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isLastLine = i === lines.length - 1
    const nextLineIsEmpty = !isLastLine && lines[i + 1] === ''
    const currentLineIsEmpty = line === ''

    // If this is the last line or the next line is empty (paragraph break),
    // just add the line as-is
    if (isLastLine || nextLineIsEmpty || currentLineIsEmpty) {
      result.push(line)
    } else {
      // Single newline case: add hard break if line doesn't already end with two spaces
      if (line.endsWith('  ')) {
        result.push(line)
      } else {
        result.push(line + '  ')
      }
    }
  }

  return result.join('\n')
}
