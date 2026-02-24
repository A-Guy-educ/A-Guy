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
})
