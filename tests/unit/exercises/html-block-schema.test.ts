// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { HtmlBlockSchema } from '../../../src/server/payload/collections/Exercises/schemas'

describe('HtmlBlockSchema', () => {
  it('accepts valid html block', () => {
    const result = HtmlBlockSchema.safeParse({ id: '1', type: 'html', html: '<p>Hello</p>' })
    expect(result.success).toBe(true)
  })

  it('rejects empty html', () => {
    const result = HtmlBlockSchema.safeParse({ id: '1', type: 'html', html: '' })
    expect(result.success).toBe(false)
  })

  it('sanitizes XSS on parse (server-side defense)', () => {
    const result = HtmlBlockSchema.safeParse({
      id: '1',
      type: 'html',
      html: '<p>ok</p><script>alert(1)</script>',
    })
    expect(result.success).toBe(true)
    expect(result.data?.html).not.toContain('<script')
  })

  it('sanitizes onerror handler on parse', () => {
    const result = HtmlBlockSchema.safeParse({
      id: '1',
      type: 'html',
      html: '<img src=x onerror=alert(1)>',
    })
    expect(result.success).toBe(true)
    expect(result.data?.html).not.toContain('onerror')
  })
})
