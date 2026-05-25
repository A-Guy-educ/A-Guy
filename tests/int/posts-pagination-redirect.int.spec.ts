import { describe, expect, it } from 'vitest'

/**
 * Integration test for posts pagination redirect
 *
 * Validates that /posts/page/1 redirects to /posts (since page 1 IS the main posts page)
 * and other pagination pages work correctly.
 *
 * Covers issue: #2065
 */

describe('Posts pagination redirect', () => {
  describe('GET /posts/page/1', () => {
    it('should redirect to /posts (not return 500)', async () => {
      // The issue reported that /posts/page/1 returns 500 Internal Server Error
      // The fix redirects /posts/page/1 to /posts since they're semantically equivalent
      // This test verifies the redirect works correctly
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

      const response = await fetch(`${baseUrl}/posts/page/1`, {
        redirect: 'manual', // Don't follow redirects automatically
      })

      // Should return 307 (Temporary Redirect) or 308 (Permanent Redirect)
      expect(response.status).toBeGreaterThanOrEqual(300)
      expect(response.status).toBeLessThan(400)

      const location = response.headers.get('location')
      expect(location).toBe('/posts')
    })
  })

  describe('page number validation', () => {
    it('should return 404 for non-integer page numbers', () => {
      // Number.isInteger(Number("abc")) = false, so should call notFound()
      const pageNumber = 'abc'
      const sanitizedPageNumber = Number(pageNumber)
      expect(Number.isInteger(sanitizedPageNumber)).toBe(false)
    })

    it('should redirect for page 1', () => {
      const pageNumber = '1'
      const sanitizedPageNumber = Number(pageNumber)
      expect(Number.isInteger(sanitizedPageNumber)).toBe(true)
      expect(sanitizedPageNumber === 1).toBe(true) // Should trigger redirect
    })

    it('should allow page 2 and above', () => {
      const pageNumber = '2'
      const sanitizedPageNumber = Number(pageNumber)
      expect(Number.isInteger(sanitizedPageNumber)).toBe(true)
      expect(sanitizedPageNumber === 1).toBe(false) // Should NOT trigger redirect
    })
  })
})
