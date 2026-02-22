import sanitizeHtmlLib from 'sanitize-html'

/**
 * Conservative sanitize-html allowlist — HLS Phase 1 §6 + safe SVG subset.
 *
 * Blocked by sanitize-html (default behavior):
 *   - all on* event handlers
 *   - javascript: and data: URIs in href/src
 *   - script tags
 *   - potentially dangerous tags
 *
 * Additional enforcement via transformTags (below):
 *   - href is removed from every element except <a>
 *
 * Link policy: target and rel are not in allowedAttributes.
 *   All links open in the same tab in Phase 1.
 */
const SANITIZE_CONFIG: sanitizeHtmlLib.IOptions = {
  allowedTags: [
    // Text structure
    'p',
    'br',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'span',
    'div',
    'section',
    // Formatting
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'del',
    'mark',
    'sub',
    'sup',
    // Lists
    'ul',
    'ol',
    'li',
    // Blocks
    'blockquote',
    'pre',
    'code',
    'hr',
    // Links & media
    'a',
    'img',
    // Tables
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    // SVG safe subset (use + foreignObject excluded)
    'svg',
    'path',
    'circle',
    'rect',
    'line',
    'polyline',
    'polygon',
    'g',
    'defs',
    'linearGradient',
    'radialGradient',
    'stop',
    'text',
    'tspan',
  ],
  allowedAttributes: {
    '*': ['class', 'id', 'dir', 'data-*'], // data-* for all elements
    a: ['href'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    // SVG attributes
    svg: ['viewBox', 'viewbox'],
    path: ['d', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'],
    circle: ['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width'],
    rect: ['x', 'y', 'width', 'height', 'fill', 'stroke', 'stroke-width'],
    line: ['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width', 'stroke-linecap'],
    polyline: ['points', 'fill', 'stroke', 'stroke-width'],
    polygon: ['points', 'fill', 'stroke', 'stroke-width'],
    g: ['transform', 'fill', 'stroke', 'opacity'],
    stop: ['offset', 'stop-color', 'stop-opacity'],
    text: ['x', 'y', 'fill', 'stroke', 'transform'],
    tspan: ['x', 'y', 'fill', 'stroke'],
    linearGradient: ['id', 'x1', 'y1', 'x2', 'y2'],
    radialGradient: ['id', 'cx', 'cy', 'r', 'fx', 'fy'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  transformTags: {
    // Remove href from all non-<a> elements
    '*': (tagName, attribs) => {
      if (tagName !== 'a' && attribs.href) {
        delete attribs.href
      }
      return {
        tagName,
        attribs,
      }
    },
  },
}

/**
 * Sanitize an HTML string using sanitize-html.
 * Safe for server-side rendering (no native dependencies).
 */
export function sanitizeHtml(html: string): string {
  return sanitizeHtmlLib(html, SANITIZE_CONFIG)
}
