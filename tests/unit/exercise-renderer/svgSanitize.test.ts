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

  // NEW TESTS FOR SMIL ANIMATIONS - Bug reproduction tests
  describe('SMIL Animation Elements', () => {
    it('should preserve <animate> elements', () => {
      const svg =
        '<svg><circle r="50"><animate attributeName="fill" from="red" to="blue" dur="1s"/></circle></svg>'
      const result = sanitizeSvg(svg)
      // After fix, animate element should be preserved
      expect(result).toContain('<animate')
      expect(result).toContain('attributeName="fill"')
    })

    it('should preserve <animateTransform> elements', () => {
      const svg =
        '<svg><circle r="50"><animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="3s"/></circle></svg>'
      const result = sanitizeSvg(svg)
      // After fix, animateTransform element should be preserved
      expect(result).toContain('<animateTransform')
      expect(result).toContain('attributeName="transform"')
    })

    it('should preserve <set> elements', () => {
      const svg =
        '<svg><circle r="50"><set attributeName="visibility" to="visible" begin="0s" dur="3s"/></circle></svg>'
      const result = sanitizeSvg(svg)
      // After fix, set element should be preserved
      expect(result).toContain('<set')
      expect(result).toContain('attributeName="visibility"')
    })

    it('should preserve animation attributes (from, to, dur, begin, end, repeatCount)', () => {
      const svg =
        '<svg><circle r="50"><animate attributeName="cx" from="0" to="100" dur="2s" begin="0s" end="5s" repeatCount="indefinite"/></circle></svg>'
      const result = sanitizeSvg(svg)
      // After fix, animation attributes should be preserved
      expect(result).toContain('from="0"')
      expect(result).toContain('to="100"')
      expect(result).toContain('dur="2s"')
      expect(result).toContain('begin="0s"')
      expect(result).toContain('end="5s"')
      expect(result).toContain('repeatCount="indefinite"')
    })

    it('should preserve href attributes on <use> elements', () => {
      const svg = '<svg><defs><circle id="c" r="50"/></defs><use href="#c"/></svg>'
      const result = sanitizeSvg(svg)
      // After fix, href attribute should be preserved
      expect(result).toContain('<use')
      expect(result).toContain('href="#c"')
    })

    it('should preserve xlink:href attributes on <use> elements', () => {
      const svg = '<svg><defs><circle id="c" r="50"/></defs><use xlink:href="#c"/></svg>'
      const result = sanitizeSvg(svg)
      // After fix, xlink:href attribute should be preserved
      expect(result).toContain('<use')
      expect(result).toContain('xlink:href="#c"')
    })

    it('should preserve linearGradient and radialGradient', () => {
      const svg =
        '<svg><defs><linearGradient id="g1"><stop offset="0%" stop-color="red"/></linearGradient></defs><rect fill="url(#g1)"/></svg>'
      const result = sanitizeSvg(svg)
      expect(result).toContain('<linearGradient')
      expect(result).toContain('stop-color="red"')
    })
  })
})
