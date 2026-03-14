import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPreviewBypassUrl } from '../../../../src/ui/cody/utils'

describe('getPreviewBypassUrl', () => {
  // Store original value and clear it before tests to simulate env not set
  const originalSecret = process.env.NEXT_PUBLIC_VERCEL_BYPASS_SECRET

  beforeAll(() => {
    delete process.env.NEXT_PUBLIC_VERCEL_BYPASS_SECRET
  })

  afterAll(() => {
    // Restore original after all tests
    if (originalSecret === undefined) {
      delete process.env.NEXT_PUBLIC_VERCEL_BYPASS_SECRET
    } else {
      process.env.NEXT_PUBLIC_VERCEL_BYPASS_SECRET = originalSecret
    }
  })

  it('returns null when previewUrl is undefined', () => {
    expect(getPreviewBypassUrl(undefined)).toBeNull()
  })

  it('returns null when previewUrl is null', () => {
    expect(getPreviewBypassUrl(null)).toBeNull()
  })

  it('returns null when previewUrl is empty string', () => {
    expect(getPreviewBypassUrl('')).toBeNull()
  })

  it('returns URL with bypass params when secret is configured', () => {
    process.env.NEXT_PUBLIC_VERCEL_BYPASS_SECRET = 'test-secret-123'

    const url = 'https://preview-abc123.vercel.app'
    const result = getPreviewBypassUrl(url)

    expect(result).toContain('https://preview-abc123.vercel.app')
    expect(result).toContain('x-vercel-protection-bypass=test-secret-123')
    expect(result).toContain('x-vercel-set-bypass-cookie=samesitenone')

    // Clean up for next test
    delete process.env.NEXT_PUBLIC_VERCEL_BYPASS_SECRET
  })

  it('returns original URL without bypass when secret is empty string', () => {
    process.env.NEXT_PUBLIC_VERCEL_BYPASS_SECRET = ''

    const url = 'https://preview-abc123.vercel.app'
    const result = getPreviewBypassUrl(url)

    // Empty string is falsy, so it should return original URL
    expect(result).toBe(url)

    // Clean up for next test
    delete process.env.NEXT_PUBLIC_VERCEL_BYPASS_SECRET
  })

  it('preserves existing query params on URL', () => {
    process.env.NEXT_PUBLIC_VERCEL_BYPASS_SECRET = 'test-secret-123'

    const url = 'https://preview-abc123.vercel.app?existing=param'
    const result = getPreviewBypassUrl(url)

    expect(result).toContain('existing=param')
    expect(result).toContain('x-vercel-protection-bypass=test-secret-123')
    expect(result).toContain('x-vercel-set-bypass-cookie=samesitenone')

    // Clean up for next test
    delete process.env.NEXT_PUBLIC_VERCEL_BYPASS_SECRET
  })

  it('works with https:// prefixed URLs', () => {
    process.env.NEXT_PUBLIC_VERCEL_BYPASS_SECRET = 'secret'
    const result = getPreviewBypassUrl('https://my-project.vercel.app')
    expect(result).toMatch(/^https:\/\//)
    delete process.env.NEXT_PUBLIC_VERCEL_BYPASS_SECRET
  })

  it('works with http:// prefixed URLs', () => {
    process.env.NEXT_PUBLIC_VERCEL_BYPASS_SECRET = 'secret'
    const result = getPreviewBypassUrl('http://localhost:3000')
    expect(result).toMatch(/^http:\/\//)
    delete process.env.NEXT_PUBLIC_VERCEL_BYPASS_SECRET
  })
})
