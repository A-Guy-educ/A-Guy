// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { sanitizeSvg } from '@/ui/web/exerciserenderer/utils/svgSanitize'

describe('sanitizeSvg', () => {
  it('passes clean SVG through', () => {
    const svg = '<svg><circle cx="50" cy="50" r="40" fill="red"/></svg>'
    const result = sanitizeSvg(svg)
    expect(result).toContain('<circle')
    expect(result).toContain('fill="red"')
  })

  it('strips script tags', () => {
    const svg = '<svg><script>alert("xss")</script><circle cx="50" cy="50" r="40"/></svg>'
    const result = sanitizeSvg(svg)
    expect(result).not.toContain('<script')
    expect(result).not.toContain('alert')
    expect(result).toContain('<circle')
  })

  it('strips onclick attributes', () => {
    const svg = '<svg><circle onclick="alert(1)" cx="50" cy="50" r="40"/></svg>'
    const result = sanitizeSvg(svg)
    expect(result).not.toContain('onclick')
  })

  it('strips onerror attributes', () => {
    const svg = '<svg><image onerror="alert(1)" href="x.png"/></svg>'
    const result = sanitizeSvg(svg)
    expect(result).not.toContain('onerror')
  })

  it('strips foreignObject elements', () => {
    const svg =
      '<svg><foreignObject><div>HTML</div></foreignObject><rect width="10" height="10"/></svg>'
    const result = sanitizeSvg(svg)
    expect(result).not.toContain('foreignObject')
    expect(result).toContain('<rect')
  })

  it('preserves data-hotspot-id attributes', () => {
    const svg = '<svg><rect data-hotspot-id="h1" width="10" height="10"/></svg>'
    const result = sanitizeSvg(svg)
    expect(result).toContain('data-hotspot-id="h1"')
  })

  it('preserves standard SVG elements', () => {
    const svg =
      '<svg><rect width="10" height="10"/><path d="M0 0 L10 10"/><g><line x1="0" y1="0" x2="10" y2="10"/></g></svg>'
    const result = sanitizeSvg(svg)
    expect(result).toContain('<rect')
    expect(result).toContain('<path')
    expect(result).toContain('<line')
  })

  it('handles empty string', () => {
    const result = sanitizeSvg('')
    expect(result).toBe('')
  })

  it('does not throw on malformed markup', () => {
    const result = sanitizeSvg('<svg><unclosed><circle cx="5"')
    expect(typeof result).toBe('string')
  })

  // SVG animation element tests - FR-2.3
  describe('preserves SVG animation elements', () => {
    it('preserves <animate> elements with attributes', () => {
      const svg =
        '<svg><circle cx="50" cy="50" r="10"><animate attributeName="r" from="10" to="50" dur="1s"/></circle></svg>'
      const result = sanitizeSvg(svg)
      expect(result).toContain('<animate')
      expect(result).toContain('attributeName="r"')
    })

    it('preserves <animateTransform> elements', () => {
      const svg =
        '<svg><rect width="100" height="100"><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="2s" repeatCount="indefinite"/></rect></svg>'
      const result = sanitizeSvg(svg)
      expect(result.toLowerCase()).toContain('animatetransform')
      expect(result).toContain('repeatCount="indefinite"')
    })

    it('preserves <animateMotion> elements', () => {
      const svg = '<svg><circle r="5"><animateMotion dur="3s" path="M0,0 L100,100"/></circle></svg>'
      const result = sanitizeSvg(svg)
      expect(result.toLowerCase()).toContain('animatemotion')
    })

    it('preserves <set> elements', () => {
      const svg = '<svg><rect><set attributeName="fill" to="red" begin="2s"/></rect></svg>'
      const result = sanitizeSvg(svg)
      expect(result).toContain('<set')
    })

    it('preserves <style> within SVG', () => {
      const svg = '<svg><style>circle { fill: blue; }</style><circle cx="50" cy="50" r="40"/></svg>'
      const result = sanitizeSvg(svg)
      expect(result).toContain('<style')
    })

    it('preserves SVG gradient elements with attributes', () => {
      const svg =
        '<svg><defs><linearGradient id="g1"><stop offset="0%" stop-color="red"/><stop offset="100%" stop-color="blue"/></linearGradient></defs><rect fill="url(#g1)" width="100" height="100"/></svg>'
      const result = sanitizeSvg(svg)
      expect(result.toLowerCase()).toContain('lineargradient')
      expect(result).toContain('stop-color="red"')
    })

    it('strips onbegin handler on animate', () => {
      const svg = '<svg><animate onbegin="alert(1)" attributeName="x"/></svg>'
      const result = sanitizeSvg(svg)
      expect(result).not.toContain('onbegin')
    })

    it('strips onend handler on animate', () => {
      const svg = '<svg><animate onend="alert(1)" attributeName="x"/></svg>'
      const result = sanitizeSvg(svg)
      expect(result).not.toContain('onend')
    })

    it('preserves <mpath> with internal href reference', () => {
      const svg =
        '<svg><defs><path id="p" d="M0,0 L100,100"/></defs><circle r="5"><animateMotion dur="3s"><mpath href="#p"/></animateMotion></circle></svg>'
      const result = sanitizeSvg(svg)
      expect(result.toLowerCase()).toContain('<mpath')
      expect(result).toContain('href="#p"')
    })

    it('strips external javascript href on mpath', () => {
      const svg = '<svg><mpath href="javascript:alert(1)"/></svg>'
      const result = sanitizeSvg(svg)
      expect(result).not.toContain('javascript:')
    })
  })
})
