import type { DefaultTypedEditorState } from '@payloadcms/richtext-lexical'
import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import { sanitizeHtml } from './sanitize-html'

/**
 * Convert Lexical editor state (JSON) to sanitized HTML string.
 * This utility allows us to:
 * 1. Use Lexical editor UI in admin panel for rich editing
 * 2. Store sanitized HTML strings in database (not Lexical JSON)
 * 3. Render with HtmlRenderer component on frontend
 *
 * @param lexicalState - The Lexical editor state object
 * @returns Sanitized HTML string
 */
export function convertLexicalToHtmlString(
  lexicalState: DefaultTypedEditorState | null | undefined,
): string {
  // Handle null/undefined
  if (!lexicalState) {
    return ''
  }

  // Convert Lexical JSON to HTML
  const html = convertLexicalToHTML({
    data: lexicalState,
  })

  // Sanitize the HTML
  return sanitizeHtml(html)
}
