/**
 * @fileType unit-test
 * @domain access-control
 * @pattern security-fix
 * @ai-summary Tests for the publishedOrAuthenticated access function
 */

import { describe, it, expect } from 'vitest'

import { publishedOrAuthenticated } from '@/server/payload/access/publishedOrAuthenticated'

describe('publishedOrAuthenticated access function', () => {
  describe('when user is authenticated', () => {
    it('should return true for admin user', () => {
      const mockReq = {
        user: { id: '1', role: 'admin' },
      } as any

      const result = publishedOrAuthenticated({ req: mockReq })

      expect(result).toBe(true)
    })

    it('should return true for student user', () => {
      const mockReq = {
        user: { id: '2', role: 'student' },
      } as any

      const result = publishedOrAuthenticated({ req: mockReq })

      expect(result).toBe(true)
    })

    it('should return true for authenticated user with no role', () => {
      const mockReq = {
        user: { id: '3' },
      } as any

      const result = publishedOrAuthenticated({ req: mockReq })

      expect(result).toBe(true)
    })
  })

  describe('when user is unauthenticated', () => {
    it('should return status constraint for null user', () => {
      const mockReq = {
        user: null,
      } as any

      const result = publishedOrAuthenticated({ req: mockReq })

      expect(result).toEqual({
        status: {
          equals: 'published',
        },
      })
    })

    it('should return status constraint for undefined user', () => {
      const mockReq = {
        user: undefined,
      } as any

      const result = publishedOrAuthenticated({ req: mockReq })

      expect(result).toEqual({
        status: {
          equals: 'published',
        },
      })
    })
  })
})
