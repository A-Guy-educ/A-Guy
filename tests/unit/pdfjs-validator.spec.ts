import { describe, it, expect } from 'vitest'
import { validateFileUrl, redactUrl } from '@/lib/pdfjs/validator'

describe('validateFileUrl', () => {
  const testOrigin = 'https://example.com'

  describe('accepts valid URLs', () => {
    it('should accept relative path starting with /', () => {
      const result = validateFileUrl('/media/sample.pdf', testOrigin)
      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.url).toBe('https://example.com/media/sample.pdf')
      }
    })

    it('should accept relative path without leading slash', () => {
      const result = validateFileUrl('media/sample.pdf', testOrigin)
      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.url).toBe('https://example.com/media/sample.pdf')
      }
    })

    it('should accept same-origin absolute URL', () => {
      const result = validateFileUrl('https://example.com/media/sample.pdf', testOrigin)
      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.url).toBe('https://example.com/media/sample.pdf')
      }
    })

    it('should accept Vercel Blob storage URL', () => {
      const blobUrl = 'https://test.blob.vercel-storage.com/file.pdf'
      const result = validateFileUrl(blobUrl, testOrigin)
      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.url).toBe(blobUrl)
      }
    })

    it('should handle URLs with query parameters', () => {
      const result = validateFileUrl('/media/sample.pdf?v=123', testOrigin)
      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.url).toBe('https://example.com/media/sample.pdf?v=123')
      }
    })

    it('should handle URLs with hash fragments', () => {
      const result = validateFileUrl('/media/sample.pdf#page=2', testOrigin)
      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.url).toBe('https://example.com/media/sample.pdf#page=2')
      }
    })
  })

  describe('rejects invalid URLs', () => {
    it('should reject missing file parameter', () => {
      const result = validateFileUrl(null, testOrigin)
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error.type).toBe('missing')
        expect(result.error.message).toContain('Missing file parameter')
      }
    })

    it('should reject empty string', () => {
      const result = validateFileUrl('', testOrigin)
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error.type).toBe('missing')
      }
    })

    it('should reject javascript: scheme', () => {
      const result = validateFileUrl('javascript:alert(1)', testOrigin)
      expect(result.valid).toBe(false)
      if (!result.valid && result.error.type === 'invalid_scheme') {
        expect(result.error.scheme).toBe('javascript:')
      }
    })

    it('should reject data: scheme', () => {
      const result = validateFileUrl('data:text/html,<script>alert(1)</script>', testOrigin)
      expect(result.valid).toBe(false)
      if (!result.valid && result.error.type === 'invalid_scheme') {
        expect(result.error.scheme).toBe('data:')
      }
    })

    it('should reject file: scheme', () => {
      const result = validateFileUrl('file:///etc/passwd', testOrigin)
      expect(result.valid).toBe(false)
      if (!result.valid && result.error.type === 'invalid_scheme') {
        expect(result.error.scheme).toBe('file:')
      }
    })

    it('should reject blob: scheme', () => {
      const result = validateFileUrl('blob:https://example.com/123', testOrigin)
      expect(result.valid).toBe(false)
      if (!result.valid && result.error.type === 'invalid_scheme') {
        expect(result.error.scheme).toBe('blob:')
      }
    })

    it('should reject overly long URLs', () => {
      const longUrl = '/media/' + 'a'.repeat(3000) + '.pdf'
      const result = validateFileUrl(longUrl, testOrigin)
      expect(result.valid).toBe(false)
      if (!result.valid && result.error.type === 'too_long') {
        expect(result.error.length).toBeGreaterThan(2048)
      }
    })

    it('should reject external origins (not same-origin or Blob)', () => {
      const result = validateFileUrl('https://evil.com/malicious.pdf', testOrigin)
      expect(result.valid).toBe(false)
      if (!result.valid && result.error.type === 'disallowed_origin') {
        expect(result.error.origin).toBe('https://evil.com')
      }
    })

    it('should reject FTP scheme', () => {
      const result = validateFileUrl('ftp://example.com/file.pdf', testOrigin)
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.error.type).toBe('invalid_scheme')
      }
    })
  })

  describe('edge cases', () => {
    it('should handle origin with port', () => {
      const originWithPort = 'http://localhost:3000'
      const result = validateFileUrl('/media/sample.pdf', originWithPort)
      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.url).toBe('http://localhost:3000/media/sample.pdf')
      }
    })

    it('should handle origin with trailing slash', () => {
      const originWithSlash = 'https://example.com/'
      const result = validateFileUrl('/media/sample.pdf', originWithSlash)
      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.url).toBe('https://example.com/media/sample.pdf')
      }
    })

    it('should handle multiple slashes in path', () => {
      const result = validateFileUrl('//media//sample.pdf', testOrigin)
      expect(result.valid).toBe(true)
      // URL normalization may handle this differently
    })

    it('should handle encoded characters', () => {
      const result = validateFileUrl('/media/my%20file.pdf', testOrigin)
      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.url).toContain('my%20file.pdf')
      }
    })

    it('should handle exactly at max length', () => {
      // Create URL that's exactly 2048 characters (after conversion to absolute)
      const originLength = testOrigin.length
      const pathLength = 2048 - originLength
      const path = '/' + 'a'.repeat(pathLength - 1)
      const result = validateFileUrl(path, testOrigin)
      expect(result.valid).toBe(true)
    })
  })
})

describe('redactUrl', () => {
  it('should redact query parameters', () => {
    const url = 'https://example.com/media/file.pdf?token=secret123'
    const redacted = redactUrl(url)
    expect(redacted).toBe('https://example.com/media/file.pdf')
    expect(redacted).not.toContain('secret123')
  })

  it('should redact hash fragments', () => {
    const url = 'https://example.com/media/file.pdf#sensitive-data'
    const redacted = redactUrl(url)
    expect(redacted).toBe('https://example.com/media/file.pdf')
    expect(redacted).not.toContain('sensitive-data')
  })

  it('should keep origin and pathname', () => {
    const url = 'https://example.com/media/subfolder/file.pdf'
    const redacted = redactUrl(url)
    expect(redacted).toBe('https://example.com/media/subfolder/file.pdf')
  })

  it('should handle invalid URLs gracefully', () => {
    const invalidUrl = 'not a valid url at all'
    const redacted = redactUrl(invalidUrl)
    expect(redacted).toBe('not a valid url at all...')
  })

  it('should truncate very long invalid URLs', () => {
    const longInvalidUrl = 'x'.repeat(100)
    const redacted = redactUrl(longInvalidUrl)
    expect(redacted.length).toBe(53) // 50 chars + '...'
    expect(redacted).toMatch(/^x+\.\.\.$/)
  })

  it('should handle URLs with port numbers', () => {
    const url = 'https://example.com:8080/media/file.pdf?query=value'
    const redacted = redactUrl(url)
    expect(redacted).toBe('https://example.com:8080/media/file.pdf')
  })
})
