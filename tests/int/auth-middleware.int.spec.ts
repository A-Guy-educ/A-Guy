import { describe, expect, it } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { middleware } from '../../src/middleware'

/**
 * Auth Middleware Integration Tests
 *
 * Tests that the middleware correctly restricts learning features to authenticated users
 * while allowing public access to landing page and course catalog.
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

describe('Auth Middleware - Learning Feature Protection', () => {
  describe('Protected routes - should redirect to /login when not authenticated', () => {
    const protectedRoutes = [
      '/study',
      '/practice',
      '/test',
      '/ask',
      '/courses/math/chapters/intro/lessons/first-lesson',
      '/courses/science/chapters/chapter-1/lessons/lesson-1/exercises/exercise-1',
    ]

    it.each(protectedRoutes)('should redirect unauthenticated request to %s to /login', (route) => {
      const request = createRequest(route)
      const response = middleware(request)

      expect(response.status).toBe(307) // Temporary redirect
      const location = response.headers.get('location')
      expect(location).toContain('/login')
      expect(location).toContain(`returnTo=${encodeURIComponent(route)}`)
    })

    it('should include returnTo query param when redirecting protected route', () => {
      const route = '/study'
      const request = createRequest(route)
      const response = middleware(request)

      const location = response.headers.get('location')
      expect(location).toContain(`/login?returnTo=${encodeURIComponent(route)}`)
    })
  })

  describe('Public routes - should pass through without redirect', () => {
    const publicRoutes = ['/', '/courses']

    it.each(publicRoutes)('should allow unauthenticated request to %s', (route) => {
      const request = createRequest(route)
      const response = middleware(request)

      // Should pass through (status 200 for NextResponse.next())
      expect(response.status).toBe(200)
      const location = response.headers.get('location')
      expect(location).toBeNull()
    })
  })

  describe('Authenticated requests - should pass through all routes', () => {
    const allRoutes = [
      '/',
      '/courses',
      '/study',
      '/practice',
      '/test',
      '/ask',
      '/courses/math/chapters/intro/lessons/first-lesson',
    ]

    it.each(allRoutes)('should allow authenticated request to %s', (route) => {
      // Create request with a payload token cookie (simulating authenticated user)
      const request = createRequest(
        route,
        'example.com',
        'payload-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
      )
      const response = middleware(request)

      // Should pass through without redirect
      expect(response.status).toBe(200)
      const location = response.headers.get('location')
      expect(location).toBeNull()
    })
  })

  describe('Edge cases', () => {
    it('should not redirect /courses with query params', () => {
      const request = createRequest('/courses?sort=popular')
      const response = middleware(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
    })

    it('should handle course slug routes correctly', () => {
      // /courses/[slug] should be protected (not just /courses)
      const courseRoute = '/courses/advanced-math'
      const request = createRequest(courseRoute)
      const response = middleware(request)

      // This should redirect because it's a specific course page, not the catalog
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/login')
    })

    it('should preserve original path in returnTo for nested routes', () => {
      const route = '/courses/math/chapters/intro/lessons/first-lesson/content/page-1'
      const request = createRequest(route)
      const response = middleware(request)

      const location = response.headers.get('location')
      expect(location).toContain(`/login?returnTo=${encodeURIComponent(route)}`)
    })
  })
})
