/**
 * @fileType utility
 * @domain shared
 * @pattern text-processing
 * @ai-summary Shared helpers for speech synthesis: markdown stripping and language detection
 */

/**
 * Strip markdown formatting, LaTeX, and code blocks from text
 * so the TTS engine reads clean plaintext.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/\$\$[\s\S]*?\$\$/g, '')
    .replace(/\$[^$]*\$/g, '')
    .replace(/\\[a-zA-Z]+(\{[^}]*\})*/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*{1,2}|_{1,2})(.*?)\1/g, '$2')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
    .replace(/^---+$/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Detect if text is primarily Hebrew based on character frequency. */
export function detectLanguage(text: string): 'he-IL' | 'en-US' {
  const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length
  return hebrewChars > latinChars ? 'he-IL' : 'en-US'
}
