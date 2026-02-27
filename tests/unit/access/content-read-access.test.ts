/**
 * @fileType unit-test
 * @domain access-control
 * @pattern security-fix
 * @ai-summary Reproduction test to verify content collections use publishedOrAuthenticated for read access
 */

import { describe, it, expect } from 'vitest'

import { Courses } from '@/server/payload/collections/Courses'
import { Chapters } from '@/server/payload/collections/Chapters'
import { Lessons } from '@/server/payload/collections/Lessons'
import { publishedOrAuthenticated } from '@/server/payload/access/publishedOrAuthenticated'
import { anyone } from '@/server/payload/access/anyone'

describe('Content Collections Read Access - Bug Reproduction', () => {
  /**
   * This test verifies that content collections use publishedOrAuthenticated for read operation.
   *
   * BUG: Previously these collections use `anyone` which allows ANYONE (including anonymous users)
   * to see draft content.
   *
   * FIX: Replace `anyone` with `publishedOrAuthenticated` for read operations.
   * This ensures:
   * - Authenticated users see all content (draft and published)
   * - Anonymous users only see published content
   */

  describe('Courses collection', () => {
    it('should use publishedOrAuthenticated for read operation', () => {
      expect(Courses.access?.read).toBe(publishedOrAuthenticated)
    })

    it('should NOT use anyone for read operation', () => {
      expect(Courses.access?.read).not.toBe(anyone)
    })

    it('should return status constraint when user is null', () => {
      const mockReq = {
        user: null,
      } as any

      const result = Courses.access!.read!({ req: mockReq })

      expect(result).toEqual({
        status: {
          equals: 'published',
        },
      })
    })

    it('should return true when user is authenticated', () => {
      const mockReq = {
        user: { id: '1' },
      } as any

      const result = Courses.access!.read!({ req: mockReq })

      expect(result).toBe(true)
    })
  })

  describe('Chapters collection', () => {
    it('should use publishedOrAuthenticated for read operation', () => {
      expect(Chapters.access?.read).toBe(publishedOrAuthenticated)
    })

    it('should NOT use anyone for read operation', () => {
      expect(Chapters.access?.read).not.toBe(anyone)
    })

    it('should return status constraint when user is null', () => {
      const mockReq = {
        user: null,
      } as any

      const result = Chapters.access!.read!({ req: mockReq })

      expect(result).toEqual({
        status: {
          equals: 'published',
        },
      })
    })

    it('should return true when user is authenticated', () => {
      const mockReq = {
        user: { id: '1' },
      } as any

      const result = Chapters.access!.read!({ req: mockReq })

      expect(result).toBe(true)
    })
  })

  describe('Lessons collection', () => {
    it('should use publishedOrAuthenticated for read operation', () => {
      expect(Lessons.access?.read).toBe(publishedOrAuthenticated)
    })

    it('should NOT use anyone for read operation', () => {
      expect(Lessons.access?.read).not.toBe(anyone)
    })

    it('should return status constraint when user is null', () => {
      const mockReq = {
        user: null,
      } as any

      const result = Lessons.access!.read!({ req: mockReq })

      expect(result).toEqual({
        status: {
          equals: 'published',
        },
      })
    })

    it('should return true when user is authenticated', () => {
      const mockReq = {
        user: { id: '1' },
      } as any

      const result = Lessons.access!.read!({ req: mockReq })

      expect(result).toBe(true)
    })
  })
})
