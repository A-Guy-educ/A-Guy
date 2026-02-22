import DOMPurify from 'isomorphic-dompurify'

/**
 * Sanitize SVG markup for safe rendering via dangerouslySetInnerHTML.
 * Strips scripts, event handlers, external references, and dangerous elements.
 * Preserves data-hotspot-id attributes for interactive SVGs.
 */
export function sanitizeSvg(svgMarkup: string): string {
  return DOMPurify.sanitize(svgMarkup, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_ATTR: ['data-hotspot-id'],
    FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'embed', 'object'],
    FORBID_ATTR: ['onclick', 'onerror', 'onload', 'onmouseover'],
  })
}
