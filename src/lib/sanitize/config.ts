/**
 * Shared DOMPurify sanitization configuration for HTML and SVG content.
 *
 * This module provides a single source of truth for sanitization rules
 * used across SafeHtml, HtmlBlockRenderer, HtmlBlockEditor, and HtmlBlockField.
 *
 * Security invariants:
 * - Script tags always stripped
 * - Event handlers (onclick, onerror, etc.) always stripped
 * - javascript: URLs always stripped
 * - Inline style attributes (style=) always blocked
 * - target attribute always blocked
 * - @import in style tags blocked at server validation level
 */
import DOMPurify from 'dompurify'

/**
 * DOMPurify configuration for HTML blocks with SVG and style support.
 * Used by SafeHtml, HtmlBlockRenderer, HtmlBlockEditor, and HtmlBlockField.
 */
export const HTML_BLOCK_PURIFY_CONFIG = {
  // Allow core content/layout tags
  ALLOWED_TAGS: [
    // Basic content
    'p',
    'br',
    'hr',
    'span',
    // Headings
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    // Text formatting
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
    // Lists
    'ul',
    'ol',
    'li',
    // Block elements
    'blockquote',
    'pre',
    'code',
    // Links and media
    'a',
    'img',
    // Containers
    'div',
    'section',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    // Semantic HTML5
    'header',
    'main',
    'footer',
    'nav',
    'article',
    'aside',
    'button',
    // Style tag (for internal CSS and @keyframes animations) - FR-1.1
    'style',
    // SVG container - FR-2.1
    'svg',
    // SVG shapes - FR-2.1
    'path',
    'circle',
    'rect',
    'line',
    'polyline',
    'polygon',
    // SVG structure - FR-2.1
    'g',
    'defs',
    'use',
    // SVG gradients - FR-2.1 (lowercase for DOMPurify normalization)
    'lineargradient',
    'radialgradient',
    'stop',
    // SVG animation tags - FR-2.3 (lowercase for DOMPurify normalization)
    'animate',
    'animatetransform',
    'animatemotion',
    'set',
    'mpath',
  ],

  // Allow safe attributes
  ALLOWED_ATTR: [
    // HTML attributes
    'href',
    'src',
    'alt',
    'title',
    'class',
    'id',
    'rel',
    'width',
    'height',
    'colspan',
    'rowspan',
    'dir',
    // SVG geometry - FR-2.2
    'd',
    'cx',
    'cy',
    'r',
    'rx',
    'ry',
    'x',
    'y',
    'points',
    // SVG presentation - FR-2.2
    'fill',
    'stroke',
    'stroke-width',
    'stroke-linecap',
    'stroke-linejoin',
    'stroke-opacity',
    'fill-rule',
    'clip-rule',
    // SVG view - FR-2.2 (lowercase for DOMPurify)
    'viewbox',
    // SVG gradient - FR-2.2
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
    'offset',
    'stop-color',
    'stop-opacity',
    // SVG animation attributes - FR-2.3
    'attributename',
    'attributetype',
    'from',
    'to',
    'dur',
    'begin',
    'end',
    'repeatcount',
    'repeatdur',
    'values',
    'keytimes',
    'keysplines',
    'calcmode',
    'type',
    'additive',
    'accumulate',
    'path',
    'keypoints',
    'rotate',
    // SVG links - FR-2.2
    'href',
    'xlink:href',
    // SVG accessibility
    'xmlns',
    'aria-hidden',
    'role',
    'focusable',
    // Data attributes (general pattern via data-* handled separately)
    'data-hotspot-id',
  ],

  // Explicitly forbid dangerous attributes
  FORBID_ATTR: [
    // Inline styles must be blocked - FR-1.1 (style TAG is allowed, style= attribute is NOT)
    'style',
    // Target attribute - intentional removal for security
    'target',
  ],

  // Explicitly forbid dangerous tags
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'foreignobject'],
}

// Track hook initialization to prevent duplicate hooks
let hookInitialized = false

/**
 * Initialize DOMPurify hook for safe link handling.
 * This sets up rel="noopener noreferrer" on anchor tags with target attributes.
 * Designed to be idempotent - calling multiple times has no additional effect.
 */
export function initDOMPurifySafeLinks(): void {
  if (hookInitialized) {
    return
  }

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.getAttribute('target')) {
      node.setAttribute('rel', 'noopener noreferrer')
    }
  })

  hookInitialized = true
}
