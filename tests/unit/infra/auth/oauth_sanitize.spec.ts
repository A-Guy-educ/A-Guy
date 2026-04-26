import { describe, expect, it } from 'vitest'
import { sanitizeReturnTo } from '@/infra/auth/oauth_sanitize'

describe('sanitizeReturnTo', () => {
  it('returns / for undefined input', () => {
    expect(sanitizeReturnTo(undefined)).toBe('/')
  })

  it('returns / for null input', () => {
    expect(sanitizeReturnTo(null)).toBe('/')
  })

  it('returns / for empty string', () => {
    expect(sanitizeReturnTo('')).toBe('/')
  })

  it('returns / for absolute HTTPS URL', () => {
    expect(sanitizeReturnTo('https://evil.com/steal-cookies')).toBe('/')
  })

  it('returns / for absolute HTTP URL', () => {
    expect(sanitizeReturnTo('http://evil.com/steal-cookies')).toBe('/')
  })

  it('returns / for data: URL', () => {
    expect(sanitizeReturnTo('data:text/html,<script>alert(1)</script>')).toBe('/')
  })

  it('returns / for javascript: URL', () => {
    expect(sanitizeReturnTo('javascript:alert(1)')).toBe('/')
  })

  it('returns / for mailto: URL', () => {
    expect(sanitizeReturnTo('mailto:attacker@evil.com')).toBe('/')
  })

  it('returns / for double-slash URL', () => {
    expect(sanitizeReturnTo('//evil.com')).toBe('/')
  })

  it('returns / for relative path without leading slash', () => {
    expect(sanitizeReturnTo('dashboard')).toBe('/')
  })

  it('returns the path for a valid path starting with /', () => {
    expect(sanitizeReturnTo('/courses')).toBe('/courses')
  })

  it('returns / for root path', () => {
    expect(sanitizeReturnTo('/')).toBe('/')
  })

  it('trims whitespace from valid paths', () => {
    expect(sanitizeReturnTo('  /courses  ')).toBe('/courses')
  })

  it('trims whitespace from dangerous URLs', () => {
    expect(sanitizeReturnTo('  https://evil.com  ')).toBe('/')
  })

  it('allows nested paths', () => {
    expect(sanitizeReturnTo('/courses/intro-to-cs/unit-1')).toBe('/courses/intro-to-cs/unit-1')
  })

  it('allows paths with query strings', () => {
    expect(sanitizeReturnTo('/courses?ref=header')).toBe('/courses?ref=header')
  })

  it('allows paths with hash fragments', () => {
    expect(sanitizeReturnTo('/courses#section')).toBe('/courses#section')
  })

  it('allows paths with both query strings and hash fragments', () => {
    expect(sanitizeReturnTo('/courses?ref=header#section')).toBe('/courses?ref=header#section')
  })
})
