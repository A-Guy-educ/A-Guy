/**
 * Strip HTML tags from a string, returning plain text.
 * Used for meta descriptions where HTML content should be rendered as text.
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}
