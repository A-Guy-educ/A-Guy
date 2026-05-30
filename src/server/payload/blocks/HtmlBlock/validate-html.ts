/**
 * @fileType utility
 * @ai-summary HTML validation for HtmlBlock - allows all content for admin users only
 *
 * SECURITY NOTE: This HtmlBlock is admin-only - only authorized content creators (teachers)
 * have access to it. The validation here is minimal to allow rich content including
 * style attributes, details/summary tags, and other HTML that would normally be sanitized.
 * Content displayed to students goes through separate rendering logic with proper escaping.
 */
export const validateHtml = (value: string | null | undefined): string | true => {
  if (!value || typeof value !== 'string') {
    return 'HTML content is required'
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return 'HTML content is required'
  }

  // Block only the most dangerous tags that could introduce security vulnerabilities
  // This is admin-only content, so we allow rich HTML including style attributes,
  // details/summary, dir attribute, data-* attributes, etc.
  const dangerousTags = [
    '<script',
    '<iframe',
    '<object',
    '<embed',
    '<applet',
    '<meta',
    '<base',
    '<link',
    '<title',
  ]

  for (const tag of dangerousTags) {
    const lowerTag = tag.toLowerCase()
    if (trimmed.toLowerCase().includes(lowerTag)) {
      if (tag === '<title') {
        return '<title> is not allowed in HtmlBlock. Put title in the page head.'
      }
      return `HTML contains blocked content: ${tag}`
    }
  }

  // Block inline event handlers (onclick, onload, etc.) - XSS prevention
  const eventHandlerPattern = /\bon\w+\s*=/gi
  const eventMatch = eventHandlerPattern.exec(trimmed)
  if (eventMatch) {
    return `inline event handlers are not allowed: ${eventMatch[0]}`
  }

  // Block javascript: URLs in href/src
  const jsUrlPattern = /(?:href|src)\s*=\s*["']?\s*javascript:/gi
  const jsMatch = jsUrlPattern.exec(trimmed)
  if (jsMatch) {
    return `javascript: URLs are not allowed: ${jsMatch[0]}`
  }

  return true
}
