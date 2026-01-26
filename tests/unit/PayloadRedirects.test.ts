import { isInternalPath, normalizePath } from '@/ui/web/PayloadRedirects'
import { describe, expect, it } from 'vitest'

describe('normalizePath', () => {
  it('should normalize /home to /home', () => {
    expect(normalizePath('/home')).toBe('/home')
  })

  it('should normalize /home/ to /home (trailing slash removed)', () => {
    expect(normalizePath('/home/')).toBe('/home')
  })

  it('should strip query string', () => {
    expect(normalizePath('/home?x=1')).toBe('/home')
  })

  it('should strip hash', () => {
    expect(normalizePath('/#x')).toBe('/')
  })

  it('should handle empty string', () => {
    expect(normalizePath('')).toBe('/')
  })

  it('should handle whitespace only', () => {
    expect(normalizePath('   ')).toBe('/')
  })

  it('should trim whitespace and normalize path', () => {
    expect(normalizePath('  /start  ')).toBe('/start')
  })

  it('should add leading slash if missing', () => {
    expect(normalizePath('home')).toBe('/home')
  })

  it('should keep root path as is', () => {
    expect(normalizePath('/')).toBe('/')
  })

  it('should handle path with query and hash', () => {
    expect(normalizePath('/path?query=1#hash')).toBe('/path')
  })

  it('should handle path with only hash', () => {
    expect(normalizePath('/path#hash')).toBe('/path')
  })
})

describe('isInternalPath', () => {
  it('should allow internal paths starting with /', () => {
    expect(isInternalPath('/start')).toBe(true)
    expect(isInternalPath('/')).toBe(true)
    expect(isInternalPath('/path/to/page')).toBe(true)
  })

  it('should reject external URLs with http://', () => {
    expect(isInternalPath('https://evil.com')).toBe(false)
    expect(isInternalPath('http://evil.com')).toBe(false)
  })

  it('should reject protocol-relative URLs', () => {
    expect(isInternalPath('//evil.com')).toBe(false)
  })

  it('should reject empty strings', () => {
    expect(isInternalPath('')).toBe(false)
  })

  it('should reject whitespace-only strings', () => {
    expect(isInternalPath('   ')).toBe(false)
  })

  it('should handle whitespace prefix on internal paths', () => {
    expect(isInternalPath(' /start')).toBe(true)
  })

  it('should handle whitespace suffix on internal paths', () => {
    expect(isInternalPath('/start ')).toBe(true)
  })

  it('should reject external URL with whitespace prefix', () => {
    expect(isInternalPath(' https://evil.com')).toBe(false)
  })

  it('should reject protocol-relative URL with whitespace prefix', () => {
    expect(isInternalPath(' //evil.com')).toBe(false)
  })
})

describe('loop protection scenarios', () => {
  it('should detect loop when source and target are identical after normalization', () => {
    const source = '/'
    const target = '/'
    const normalizedSource = normalizePath(source)
    const normalizedTarget = normalizePath(target)
    expect(normalizedTarget).toBe(normalizedSource)
  })

  it('should detect loop when source /a redirects to /a/', () => {
    const source = '/a'
    const target = '/a/'
    const normalizedSource = normalizePath(source)
    const normalizedTarget = normalizePath(target)
    expect(normalizedTarget).toBe(normalizedSource)
  })

  it('should detect loop with query strings', () => {
    const source = '/a'
    const target = '/a/?query=1'
    const normalizedSource = normalizePath(source)
    const normalizedTarget = normalizePath(target)
    expect(normalizedTarget).toBe(normalizedSource)
  })
})

describe('path normalization edge cases', () => {
  it('should handle multiple consecutive slashes', () => {
    // Note: normalizePath doesn't handle this, but ensure it doesn't break
    expect(normalizePath('//home')).toBe('//home')
  })

  it('should handle trailing slash on root', () => {
    expect(normalizePath('/')).toBe('/')
  })

  it('should handle very long paths', () => {
    const longPath = '/' + 'a'.repeat(1000)
    expect(normalizePath(longPath)).toBe(longPath)
  })

  it('should handle special characters', () => {
    expect(normalizePath('/path with spaces')).toBe('/path with spaces')
    expect(normalizePath('/path-with-dashes')).toBe('/path-with-dashes')
    expect(normalizePath('/path_with_underscores')).toBe('/path_with_underscores')
  })
})
