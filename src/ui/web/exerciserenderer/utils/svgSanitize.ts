import DOMPurify from 'dompurify'

/**
 * Sanitize SVG markup for safe rendering via dangerouslySetInnerHTML.
 * Strips scripts, event handlers, external references, and dangerous elements.
 * Preserves data-hotspot-id attributes for interactive SVGs.
 * Preserves SVG animation elements (animate, animateTransform, animateMotion, set, mpath).
 */
export function sanitizeSvg(svgMarkup: string): string {
  if (!svgMarkup) return ''
  if (typeof window === 'undefined') return svgMarkup
  return DOMPurify.sanitize(svgMarkup, {
    USE_PROFILES: { svg: true, svgFilters: true },
    // Add SVG animation tags (lowercase for DOMPurify normalization) - FR-2.3
    ADD_TAGS: ['animate', 'animatetransform', 'animatemotion', 'set', 'mpath', 'style'],
    // Add SVG animation and link attributes - FR-2.2, FR-2.3
    ADD_ATTR: [
      'data-hotspot-id',
      // SVG animation attributes
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
      // SVG links
      'href',
      'xlink:href',
    ],
    // Keep existing forbidden tags
    FORBID_TAGS: ['script', 'foreignobject', 'iframe', 'embed', 'object'],
    // Expand to include SVG animation event handlers - defense-in-depth
    FORBID_ATTR: [
      'onclick',
      'onerror',
      'onload',
      'onmouseover',
      // SVG animation event handlers - defense-in-depth per security review
      'onbegin',
      'onend',
      'onrepeat',
      'onfocusin',
      'onfocusout',
      'onactivate',
    ],
  })
}
