import sanitizeHtmlLib from 'sanitize-html'
import type { IOptions } from 'sanitize-html'

/**
 * Conservative allowlist — HLS Phase 1 §6 + safe SVG subset.
 *
 * sanitize-html automatically blocks:
 *   - all on* event handlers
 *   - javascript: and data: URIs (via allowedSchemes)
 *   - unallowed tags and attributes
 *
 * Additional enforcement via transformTags (below):
 *   - href is removed from every element except <a>
 *
 * Link policy: target and rel are not in allowedAttributes.
 *   All links open in the same tab in Phase 1.
 */
const SANITIZE_CONFIG: IOptions = {
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
    // SVG safe subset (foreignObject excluded)
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
    // Global attributes
    '*': ['class', 'id', 'dir'],
    // Link attributes
    a: ['href', 'title'],
    // Image attributes
    img: ['src', 'alt', 'title', 'width', 'height'],
    // SVG attributes
    svg: ['viewBox', 'width', 'height', 'aria-hidden', 'role', 'focusable'],
    path: ['d', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity'],
    circle: ['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width', 'opacity'],
    rect: ['x', 'y', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'opacity'],
    line: ['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width', 'stroke-linecap'],
    polyline: ['points', 'fill', 'stroke', 'stroke-width'],
    polygon: ['points', 'fill', 'stroke', 'stroke-width'],
    g: ['transform', 'opacity'],
    linearGradient: ['id', 'x1', 'y1', 'x2', 'y2'],
    radialGradient: ['id', 'cx', 'cy', 'r'],
    stop: ['offset', 'stop-color', 'stop-opacity'],
    text: ['x', 'y', 'fill', 'opacity'],
    tspan: ['x', 'y', 'fill', 'opacity'],
  },
  // Allow data-* attributes
  allowedClasses: {
    '*': ['*'], // Allow all classes
  },
  // Validate URLs - only allow safe schemes
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['http', 'https', 'data'], // Allow data URIs for images only
  },
  allowProtocolRelative: true,
  // Remove href from non-<a> elements
  transformTags: {
    '*': (tagName: string, attribs: Record<string, string>) => {
      // Remove href from all non-anchor tags
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
 * Sanitize an HTML string using sanitize-html library.
 * Safe in both Node.js (SSR) and browser environments (pure JS, no native deps).
 */
export function sanitizeHtml(html: string): string {
  return sanitizeHtmlLib(html, SANITIZE_CONFIG)
}
