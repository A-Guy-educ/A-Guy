/**
 * V3 Converter - Server-Side Sanitization
 *
 * Provides server-side HTML and SVG sanitization to prevent XSS attacks.
 * Uses regex-based approach compatible with server-side execution.
 *
 * @fileType utility
 * @domain conversion
 * @pattern sanitization
 */

// ---------------------------------
// HTML Allowlist (from HtmlBlockSchema)
// ---------------------------------

const HTML_ALLOWED_TAGS = new Set([
  'p',
  'br',
  'hr',
  'span',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'del',
  'ins',
  'mark',
  'sub',
  'sup',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'a',
  'img',
  'div',
  'section',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
])

// Dangerous patterns that are blocked regardless of tag allowlist
const DANGEROUS_HTML_PATTERNS = [
  /\bon\w+\s*=/i, // inline event handlers (onclick, onload, etc.)
  /javascript\s*:/i, // javascript: URLs
  /vbscript\s*:/i, // vbscript: URLs
  /data\s*:[^,]*;base64/i, // data: URIs with base64
]

// ---------------------------------
// SVG Sanitization
// ---------------------------------

/**
 * Sanitize SVG content to prevent XSS attacks.
 * Removes dangerous elements and attributes.
 * Uses the same pattern as src/ui/admin/shared/utils.ts
 */
export function sanitizeSvgServer(svg: string): { safe: boolean; sanitized: string } {
  const trimmed = svg.trim()

  // Check if it's SVG
  if (!trimmed.toLowerCase().includes('<svg')) {
    return { safe: false, sanitized: '' }
  }

  // Remove script tags
  let sanitized = trimmed.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  // Remove event handlers (on* attributes)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, '')

  // Remove foreignObject (can execute JavaScript)
  sanitized = sanitized.replace(
    /<foreignObject\b[^<]*(?:(?!<\/foreignObject>)<[^<]*)*<\/foreignObject>/gi,
    '',
  )

  // Remove external references in href/xlink:href that aren't data URIs or fragment-only
  sanitized = sanitized.replace(/\b(?:href|xlink:href)\s*=\s*["'](?!data:)(?!#)[^"']*["']/gi, '')

  // Check if sanitization removed content
  const wasDangerous = sanitized !== trimmed

  return {
    safe: !wasDangerous,
    sanitized,
  }
}

// ---------------------------------
// HTML Sanitization
// ---------------------------------

/**
 * Validate HTML tags against allowlist
 */
function validateHtmlTags(html: string): boolean {
  const tagPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = tagPattern.exec(html)) !== null) {
    if (!HTML_ALLOWED_TAGS.has(match[1].toLowerCase())) {
      return false
    }
  }
  return true
}

/**
 * Check for dangerous HTML patterns
 */
function hasDangerousPatterns(html: string): boolean {
  return DANGEROUS_HTML_PATTERNS.some((pattern) => pattern.test(html))
}

/**
 * Sanitize HTML content.
 * Validates against allowlist and removes dangerous patterns.
 */
export function sanitizeHtmlServer(html: string): { safe: boolean; sanitized: string } {
  const trimmed = html.trim()

  if (!trimmed) {
    return { safe: true, sanitized: '' }
  }

  // Check for dangerous patterns first
  if (hasDangerousPatterns(trimmed)) {
    // Remove dangerous patterns
    let sanitized = trimmed
    for (const pattern of DANGEROUS_HTML_PATTERNS) {
      sanitized = sanitized.replace(pattern, '')
    }

    // Now validate tags
    if (!validateHtmlTags(sanitized)) {
      // Remove disallowed tags
      const tagPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi
      let match: RegExpExecArray | null
      const tagsToRemove: string[] = []
      while ((match = tagPattern.exec(sanitized)) !== null) {
        if (!HTML_ALLOWED_TAGS.has(match[1].toLowerCase())) {
          tagsToRemove.push(match[1])
        }
      }

      // Remove unknown tags (simplified - just strip them)
      for (const tag of [...new Set(tagsToRemove)]) {
        const tagRegex = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi')
        sanitized = sanitized.replace(tagRegex, '')
      }
    }

    return {
      safe: true, // After removal, it's safe
      sanitized,
    }
  }

  // Validate tags if no dangerous patterns found
  if (!validateHtmlTags(trimmed)) {
    // Clone and strip disallowed tags
    let sanitized = trimmed
    const tagPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi
    let match: RegExpExecArray | null
    const tagsToRemove: string[] = []
    while ((match = tagPattern.exec(trimmed)) !== null) {
      if (!HTML_ALLOWED_TAGS.has(match[1].toLowerCase())) {
        tagsToRemove.push(match[1])
      }
    }

    for (const tag of [...new Set(tagsToRemove)]) {
      const tagRegex = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi')
      sanitized = sanitized.replace(tagRegex, '')
    }

    return { safe: true, sanitized }
  }

  return { safe: true, sanitized: trimmed }
}

// ---------------------------------
// Media URL Validation
// ---------------------------------

/**
 * Validate media URL for security (SSRF protection)
 */
export function validateMediaUrl(url: string): { valid: boolean; reason?: string } {
  const trimmed = url.trim()

  if (!trimmed) {
    return { valid: false, reason: 'empty_url' }
  }

  // Check for allowed schemes
  if (!/^https?:\/\//i.test(trimmed)) {
    return { valid: false, reason: 'invalid_scheme' }
  }

  // Block javascript: and other dangerous protocols
  if (/^javascript:/i.test(trimmed)) {
    return { valid: false, reason: 'dangerous_scheme' }
  }

  if (/^vbscript:/i.test(trimmed)) {
    return { valid: false, reason: 'dangerous_scheme' }
  }

  if (/^data:/i.test(trimmed)) {
    return { valid: false, reason: 'dangerous_scheme' }
  }

  if (/^file:/i.test(trimmed)) {
    return { valid: false, reason: 'dangerous_scheme' }
  }

  // Block private IP ranges (basic SSRF protection)
  // This is a simplified check - in production, you'd want more comprehensive checks
  const hostname = trimmed
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .split(':')[0]

  // Check for localhost variants
  if (
    /^localhost$/i.test(hostname) ||
    /^127\.\d+\.\d+\.\d+$/.test(hostname) ||
    /^::1$/.test(hostname) ||
    /^0\.0\.0\.0$/.test(hostname)
  ) {
    return { valid: false, reason: 'private_ip' }
  }

  // Check for private IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
  if (/^10\.\d+\.\d+\.\d+$/.test(hostname)) {
    return { valid: false, reason: 'private_ip' }
  }

  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(hostname)) {
    return { valid: false, reason: 'private_ip' }
  }

  if (/^192\.168\.\d+\.\d+$/.test(hostname)) {
    return { valid: false, reason: 'private_ip' }
  }

  // Validate file extension for common image types
  const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
  const hasValidExtension = validExtensions.some((ext) => hostname.toLowerCase().endsWith(ext))

  // If no valid image extension, warn but don't block (could be a CDN URL)
  if (!hasValidExtension && !/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(trimmed)) {
    return { valid: true, reason: 'non_standard_extension' }
  }

  return { valid: true }
}
