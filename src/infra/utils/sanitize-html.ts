import DOMPurify, { type Config } from 'isomorphic-dompurify'

/**
 * Conservative DOMPurify allowlist — HLS Phase 1 §6 + safe SVG subset.
 *
 * Blocked regardless of config (DOMPurify always strips):
 *   - all on* event handlers
 *   - javascript: and data: URIs in any attribute
 *   - xlink:href (namespace attr, stripped by default)
 *   - foreignObject (not in ALLOWED_TAGS)
 *
 * Additional enforcement via hook (below):
 *   - href is removed from every element except <a> *
 * Link policy: target and rel are not in ALLOWED_ATTR.
 *   All links open in the same tab in Phase 1.
 */
const SANITIZE_CONFIG: Config = {
  ALLOWED_TAGS: [
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
  ALLOWED_ATTR: [
    'href',
    'src',
    'alt',
    'title',
    'width',
    'height',
    'class',
    'id',
    'dir',
    // SVG presentation
    'viewBox',
    'viewbox',
    'fill',
    'stroke',
    'stroke-width',
    'stroke-linecap',
    'stroke-linejoin',
    'stroke-dasharray',
    'stroke-dashoffset',
    'd',
    'cx',
    'cy',
    'r',
    'x',
    'y',
    'x1',
    'y1',
    'x2',
    'y2',
    'points',
    'offset',
    'stop-color',
    'stop-opacity',
    'opacity',
    'transform',
    'aria-hidden',
    'role',
    'focusable',
  ],
  ALLOW_DATA_ATTR: true,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
}

/**
 * Idempotent hook: remove href from all non-<a> elements.
 *
 * Uses globalThis so the registration flag survives Next.js HMR module
 * re-evaluation. A module-level variable would reset on each HMR reload,
 * causing the hook to be registered multiple times on the same DOMPurify
 * singleton. globalThis persists for the lifetime of the Node.js process
 * (SSR) and the browser tab (client), so addHook runs exactly once.
 */
declare global {
  var __aguyDomPurifyHrefHookRegistered: boolean | undefined
}

if (!globalThis.__aguyDomPurifyHrefHookRegistered) {
  DOMPurify.addHook('afterSanitizeAttributes', (node: Element) => {
    if (node.tagName !== 'A' && node.hasAttribute('href')) {
      node.removeAttribute('href')
    }
  })
  globalThis.__aguyDomPurifyHrefHookRegistered = true
}

/**
 * Sanitize an HTML string using DOMPurify.
 * Safe in SSR (Node.js via isomorphic-dompurify's jsdom) and browser.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG) as unknown as string
}
