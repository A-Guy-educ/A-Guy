/**
 * Shared HTML validation logic for HtmlBlock and ContentPages.
 *
 * Extracted from HtmlBlock/config.ts — same rules, single source of truth.
 */

const DANGEROUS_TAGS = [
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

const ALLOWED_TAGS = [
  'div',
  'span',
  'p',
  'br',
  'hr',
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
  'ul',
  'ol',
  'li',
  'a',
  'blockquote',
  'pre',
  'code',
  'style',
  'header',
  'main',
  'footer',
  'section',
  'nav',
  'article',
  'aside',
  'button',
  'svg',
  'path',
  'circle',
  'rect',
  'line',
  'polyline',
  'polygon',
  'g',
  'defs',
  'lineargradient',
  'radialgradient',
  'stop',
  'use',
]

const SVG_GEOMETRY_TAGS = [
  'path',
  'circle',
  'rect',
  'line',
  'polyline',
  'polygon',
  'g',
  'defs',
  'lineargradient',
  'radialgradient',
  'stop',
  'use',
]

const SVG_ATTRS = [
  'd',
  'viewbox',
  'xmlns',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'width',
  'height',
  'cx',
  'cy',
  'r',
  'x',
  'y',
  'rx',
  'ry',
  'points',
  'aria-hidden',
  'role',
  'focusable',
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientunits',
  'gradienttransform',
  'x1',
  'x2',
  'y1',
  'y2',
  'fx',
  'fy',
  'fr',
  'spreadmethod',
  'href',
  'xlink:href',
  'clip-rule',
  'fill-rule',
  'stroke-opacity',
]

function isAllowedAttribute(
  attrName: string,
  tagName: string,
  trimmed: string,
): { allowed: boolean; message?: string } {
  const lowerAttr = attrName.toLowerCase()

  if (lowerAttr === 'class') return { allowed: true }
  if (lowerAttr === 'id') return { allowed: true }
  if (lowerAttr.startsWith('data-')) return { allowed: true }

  if (lowerAttr === 'style')
    return { allowed: false, message: 'style attributes are not allowed: style=' }
  if (lowerAttr === 'target')
    return { allowed: false, message: 'target attributes are not allowed: target=' }
  if (lowerAttr.startsWith('on')) {
    const originalAttrMatch = new RegExp(`${attrName}\\s*=`, 'i').exec(trimmed)
    const originalAttr = originalAttrMatch ? originalAttrMatch[0] : 'on*'
    return {
      allowed: false,
      message: `inline event handlers are not allowed: ${originalAttr}`,
    }
  }

  if (tagName === 'svg' || ['lineargradient', 'radialgradient'].includes(tagName)) {
    if (lowerAttr === 'href' || lowerAttr === 'xlink:href') {
      return {
        allowed: false,
        message: 'href attributes on SVG elements are not allowed. Use <a> tags for links.',
      }
    }
    if (SVG_ATTRS.includes(lowerAttr)) return { allowed: true }
  }

  if (tagName === 'stop' || tagName === 'use') {
    if (tagName === 'use' && (lowerAttr === 'href' || lowerAttr === 'xlink:href')) {
      return {
        allowed: false,
        message: 'href attributes on SVG elements are not allowed. Use <a> tags for links.',
      }
    }
    if (SVG_ATTRS.includes(lowerAttr)) return { allowed: true }
  }

  if (SVG_GEOMETRY_TAGS.includes(tagName)) {
    if (SVG_ATTRS.includes(lowerAttr)) return { allowed: true }
  }

  if (tagName === 'a') {
    if (lowerAttr === 'href') return { allowed: true }
    if (lowerAttr === 'title') return { allowed: true }
  }

  return {
    allowed: false,
    message: `attribute "${attrName}" is not allowed on <${tagName}>`,
  }
}

/**
 * Validate HTML content for safe rendering.
 * Blocks dangerous tags, event handlers, external URLs, and disallowed attributes.
 */
export function validateHtmlContent(value: string | null | undefined): string | true {
  if (!value || typeof value !== 'string') {
    return 'HTML content is required'
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return 'HTML content is required'
  }

  for (const tag of DANGEROUS_TAGS) {
    if (trimmed.toLowerCase().includes(tag.toLowerCase())) {
      if (tag === '<title') {
        return '<title> is not allowed in HtmlBlock. Put title in the page head.'
      }
      return `HTML contains blocked content: ${tag}`
    }
  }

  const foreignObjectPattern =
    /<svg[^>]*>[\s\S]*?<foreignObject[\s\S]*?<\/foreignObject[\s\S]*?<\/svg>/gi
  if (foreignObjectPattern.test(trimmed)) {
    return 'foreignObject is not allowed in SVG'
  }

  const eventHandlerPattern = /\bon\w+\s*=/gi
  const eventMatch = eventHandlerPattern.exec(trimmed)
  if (eventMatch) {
    return `inline event handlers are not allowed: ${eventMatch[0]}`
  }

  const jsUrlPattern = /href\s*=\s*["']?\s*javascript:/gi
  if (jsUrlPattern.exec(trimmed)) {
    return `javascript: URLs are not allowed`
  }

  const dataHrefPattern = /href\s*=\s*["']?\s*data:/gi
  if (dataHrefPattern.exec(trimmed)) {
    return `data: URLs are not allowed in href`
  }

  const dataUrlPattern = /src\s*=\s*["']?\s*data:/gi
  if (dataUrlPattern.exec(trimmed)) {
    return `data: URLs are not allowed`
  }

  const protocolRelativeHrefPattern = /href\s*=\s*["']?\s*\/\//gi
  if (protocolRelativeHrefPattern.exec(trimmed)) {
    return `Protocol-relative URLs (//) are not allowed`
  }

  const externalHrefPattern = /href\s*=\s*["']?\s*https?:\/\//gi
  if (externalHrefPattern.exec(trimmed)) {
    return `href must start with / or #`
  }

  const mailtoPattern = /href\s*=\s*["']?\s*mailto:/gi
  if (mailtoPattern.exec(trimmed)) {
    return `mailto: links are not allowed`
  }

  const telPattern = /href\s*=\s*["']?\s*tel:/gi
  if (telPattern.exec(trimmed)) {
    return `tel: links are not allowed`
  }

  const ftpPattern = /href\s*=\s*["']?\s*ftp:/gi
  if (ftpPattern.exec(trimmed)) {
    return `ftp: links are not allowed`
  }

  const tagCheckPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi
  let tagCheckMatch
  while ((tagCheckMatch = tagCheckPattern.exec(trimmed)) !== null) {
    const tagName = tagCheckMatch[1].toLowerCase()
    if (!ALLOWED_TAGS.includes(tagName)) {
      return `HTML contains disallowed tag: <${tagName}>`
    }
  }

  const anchorTagPattern = /<a\b([^>]*)>/gi
  let anchorMatch
  while ((anchorMatch = anchorTagPattern.exec(trimmed)) !== null) {
    const attrs = anchorMatch[1]

    const hrefAttrPattern = /href\s*=\s*["']?([^"'\s>]+)["']?/gi
    const hrefAttrMatch = hrefAttrPattern.exec(attrs)
    if (!hrefAttrMatch) {
      return 'href attribute is required on <a> tags'
    }

    const hrefValue = hrefAttrMatch[1]
    if (!hrefValue || hrefValue.length === 0) {
      return 'href attribute cannot be empty'
    }

    const firstChar = hrefValue.charAt(0)
    if (firstChar !== '/' && firstChar !== '#') {
      return `href must start with / or #: href="${hrefValue}"`
    }

    const allAttrPattern = /\b([a-zA-Z][a-zA-Z0-9-]*)\s*=/gi
    let attrMatch
    while ((attrMatch = allAttrPattern.exec(attrs)) !== null) {
      const result = isAllowedAttribute(attrMatch[1], 'a', trimmed)
      if (!result.allowed) {
        return result.message ?? `attribute "${attrMatch[1]}" is not allowed on <a>`
      }
    }
  }

  const generalTagPattern = /<(?!a\b)([a-z][a-z0-9]*)\b([^>]*)>/gi
  let tagMatch
  while ((tagMatch = generalTagPattern.exec(trimmed)) !== null) {
    const tagName = tagMatch[1].toLowerCase()
    const tagAttrs = tagMatch[2]

    const allAttrPattern = /\b([a-zA-Z][a-zA-Z0-9-]*)\s*=/gi
    let attrMatch
    while ((attrMatch = allAttrPattern.exec(tagAttrs)) !== null) {
      const result = isAllowedAttribute(attrMatch[1], tagName, trimmed)
      if (!result.allowed) {
        return result.message ?? `attribute "${attrMatch[1]}" is not allowed on <${tagName}>`
      }
    }
  }

  return true
}
