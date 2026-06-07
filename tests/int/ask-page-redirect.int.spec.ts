import { describe, expect, it } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { middleware } from '../../src/middleware'

/**
 * Auth Middleware Integration Tests - /ask route
 *
 * Bug #2504: /ask route redirects to /start instead of rendering
 *
 * The /ask page should be accessible to unauthenticated users.
 * The page itself handles course selection requirements via RequireCourseSelection.
 * The middleware should NOT redirect /ask to /login.
 */

const createRequest = (path: string, host = 'example.com', cookies?: string) => {
  const url = new URL(path, `http://${host}`)
  const headers = new Headers()
  headers.set('host', host)
  if (cookies) {
    headers.set('cookie', cookies)
  }
  return new NextRequest(url, { headers })
}

describe('Bug #2504 - /ask route redirect issue', () => {
  describe('The /ask route should NOT be protected by middleware', () => {
    it('should allow unauthenticated request to /ask pass through (not redirect to /login)', () => {
      const request = createRequest('/ask')
      const response = middleware(request)

      // The bug was that /ask was in protectedPaths, causing redirect to /login
      // Expected: /ask should pass through without redirect
      expect(response.status).toBe(200)
      const location = response.headers.get('location')
      expect(location).toBeNull()
    })

    it('should allow unauthenticated request to /ask/ (with trailing slash) pass through', () => {
      const request = createRequest('/ask/')
      const response = middleware(request)

      expect(response.status).toBe(200)
      const location = response.headers.get('location')
      expect(location).toBeNull()
    })

    it('should allow authenticated request to /ask pass through', () => {
      const request = createRequest('/ask', 'example.com', 'payload-token=authenticated-user-token')
      const response = middleware(request)

      expect(response.status).toBe(200)
      const location = response.headers.get('location')
      expect(location).toBeNull()
    })
  })

  describe('Other protected routes should still be protected', () => {
    it('should still redirect unauthenticated /study to /login', () => {
      const request = createRequest('/study')
      const response = middleware(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/login')
    })

    it('should still redirect unauthenticated /practice to /login', () => {
      const request = createRequest('/practice')
      const response = middleware(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/login')
    })

    it('should still redirect unauthenticated /test to /login', () => {
      const request = createRequest('/test')
      const response = middleware(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/login')
    })
  })
})
