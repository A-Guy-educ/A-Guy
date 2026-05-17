import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { getPublicBaseUrl } from '@/infra/auth/oauth_url'

function makeReq(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, { headers })
}

describe('getPublicBaseUrl', () => {
  const originalEnv = process.env.NEXT_PUBLIC_SERVER_URL

  afterEach(() => {
    process.env.NEXT_PUBLIC_SERVER_URL = originalEnv ?? ''
  })

  describe('without NEXT_PUBLIC_SERVER_URL configured', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_SERVER_URL = ''
    })

    it('uses single forwarded proto + host', () => {
      const req = makeReq('http://internal-host/api/oauth/google', {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'app.example.com',
      })
      expect(getPublicBaseUrl(req)).toBe('https://app.example.com')
    })

    it('falls back to request origin when no forwarded headers', () => {
      const req = makeReq('https://app.example.com/api/oauth/google')
      expect(getPublicBaseUrl(req)).toBe('https://app.example.com')
    })

    // Bug reproduction: chained proxies (CDN -> LB -> app) make these headers
    // comma-separated lists. The base URL must use only the first
    // (client-facing) value, or redirect_uri won't match Google's registration.
    it('uses only the first value when x-forwarded-host is a list', () => {
      const req = makeReq('http://internal-host/api/oauth/google', {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'app.example.com, internal-lb',
      })
      expect(getPublicBaseUrl(req)).toBe('https://app.example.com')
    })

    it('uses only the first value when x-forwarded-proto is a list', () => {
      const req = makeReq('http://internal-host/api/oauth/google', {
        'x-forwarded-proto': 'https,https',
        'x-forwarded-host': 'app.example.com',
      })
      expect(getPublicBaseUrl(req)).toBe('https://app.example.com')
    })

    it('trims whitespace around forwarded values', () => {
      const req = makeReq('http://internal-host/api/oauth/google', {
        'x-forwarded-proto': '  https  ',
        'x-forwarded-host': '  app.example.com  ',
      })
      expect(getPublicBaseUrl(req)).toBe('https://app.example.com')
    })

    it('falls back to origin when forwarded host present but proto missing', () => {
      const req = makeReq('https://app.example.com/api/oauth/google', {
        'x-forwarded-host': 'app.example.com',
      })
      expect(getPublicBaseUrl(req)).toBe('https://app.example.com')
    })
  })

  describe('with NEXT_PUBLIC_SERVER_URL configured (authoritative)', () => {
    it('returns the configured URL, ignoring forwarded headers', () => {
      process.env.NEXT_PUBLIC_SERVER_URL = 'https://app.example.com'
      const req = makeReq('http://internal-host/api/oauth/google', {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'attacker.evil.com',
      })
      expect(getPublicBaseUrl(req)).toBe('https://app.example.com')
    })

    it('strips a trailing slash from the configured URL', () => {
      process.env.NEXT_PUBLIC_SERVER_URL = 'https://app.example.com/'
      const req = makeReq('https://app.example.com/api/oauth/google')
      expect(getPublicBaseUrl(req)).toBe('https://app.example.com')
    })

    it('ignores a spoofed host even when no real proxy is present', () => {
      process.env.NEXT_PUBLIC_SERVER_URL = 'https://app.example.com'
      const req = makeReq('http://internal/api/oauth/google', {
        'x-forwarded-host': 'attacker.evil.com',
        'x-forwarded-proto': 'https',
      })
      expect(getPublicBaseUrl(req)).toBe('https://app.example.com')
    })

    it('falls back to header logic when configured value is blank', () => {
      process.env.NEXT_PUBLIC_SERVER_URL = '   '
      const req = makeReq('http://internal-host/api/oauth/google', {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'app.example.com',
      })
      expect(getPublicBaseUrl(req)).toBe('https://app.example.com')
    })
  })
})
