import DOMPurify from 'dompurify'

/**
 * Sanitize SVG markup for safe rendering via dangerouslySetInnerHTML.
 * Strips scripts, event handlers, external references, and dangerous elements.
 * Preserves data-hotspot-id attributes for interactive SVGs.
 *
 * Supports:
 * - Standard SVG elements (path, circle, rect, etc.)
 * - Gradients (linearGradient, radialGradient)
 * - SMIL animations (<animate>, <animateTransform>, <set>)
 * - CSS animations within SVG (<style>)
 * - <use> element references with href/xlink:href
 */
export function sanitizeSvg(svgMarkup: string): string {
  if (!svgMarkup) return ''
  if (typeof window === 'undefined') return svgMarkup
  return DOMPurify.sanitize(svgMarkup, {
    // Use custom ALLOWED_TAGS instead of USE_PROFILES to preserve SMIL animations
    ALLOWED_TAGS: [
      'svg',
      'g',
      'defs',
      'desc',
      'title',
      'symbol',
      'use',
      'path',
      'rect',
      'circle',
      'ellipse',
      'line',
      'polyline',
      'polygon',
      'text',
      'tspan',
      'textPath',
      'linearGradient',
      'radialGradient',
      'stop',
      'animate',
      'animateTransform',
      'set',
      'mpath', // SMIL animations
      'style', // CSS animations within SVG
    ],
    ALLOWED_ATTR: [
      'viewBox',
      'width',
      'height',
      'x',
      'y',
      'fill',
      'stroke',
      'stroke-width',
      'd',
      'points',
      'cx',
      'cy',
      'r',
      'rx',
      'ry',
      'transform',
      'gradientUnits',
      'gradientTransform',
      'offset',
      'stop-color',
      'stop-opacity',
      'href',
      'xlink:href', // For <use> element references
      'requiredFeatures',
      'preserveAspectRatio',
      // Animation attributes
      'attributeName',
      'from',
      'to',
      'dur',
      'begin',
      'end',
      'repeatCount',
      'values',
      'keyTimes',
      'keySplines',
      'transformType',
      'additive',
      'accumulate',
      'data-hotspot-id', // Custom attribute for interactive SVGs
    ],
    FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'embed', 'object'],
    FORBID_ATTR: ['onclick', 'onerror', 'onload', 'onmouseover'],
  })
}
