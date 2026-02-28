/**
 * @fileType unit-test
 * @domain access-control
 * @pattern security-fix
 * @ai-summary Reproduction test to verify content collections use status-aware read access
 */

import { describe, it, expect } from 'vitest'

import { Courses } from '@/server/payload/collections/Courses'
import { Chapters } from '@/server/payload/collections/Chapters'
import { Lessons } from '@/server/payload/collections/Lessons'
import { Categories } from '@/server/payload/collections/Categories'
import { PricingPlans } from '@/server/payload/collections/PricingPlans'
import { Media } from '@/server/payload/collections/Media'
import { adminOnly } from '@/server/payload/access/adminOnly'
import { anyone } from '@/server/payload/access/anyone'
import { authenticated } from '@/server/payload/access/authenticated'

describe('Content Collections Access Control - Bug Reproduction', () => {
  /**
   * This test verifies that content-management collections use adminOnly for CUD operations.
   *
   * BUG: Previously these collections used `read: anyone` which allowed anonymous users
   * to access draft and archived content via the API.
   *
   * FIX: Replace `read: anyone` with status-aware access function that:
   * - Returns true for authenticated users (they see all content)
   * - Returns status filter for anonymous users (they see only published)
   */

  describe('Courses collection', () => {
    it('should use adminOnly for create, update, and delete operations', () => {
      expect(Courses.access?.create).toBe(adminOnly)
      expect(Courses.access?.update).toBe(adminOnly)
      expect(Courses.access?.delete).toBe(adminOnly)
    })

    it('should NOT use anyone for read operation (fixed)', () => {
      expect(Courses.access?.read).not.toBe(anyone)
    })

    it('should return true for authenticated users', () => {
      const mockReq = { user: { id: 'user-1', role: 'student' } } as any
      const result = Courses.access?.read?.({ req: mockReq })
      expect(result).toBe(true)
    })

    it('should return status filter for anonymous users', () => {
      const mockReq = { user: null } as any
      const result = Courses.access?.read?.({ req: mockReq })
      expect(result).toEqual({ status: { equals: 'published' } })
    })

    // This test documents the current (buggy) state - it will fail before the fix
    it('should NOT use authenticated for write operations', () => {
      expect(Courses.access?.create).not.toBe(authenticated)
      expect(Courses.access?.update).not.toBe(authenticated)
      expect(Courses.access?.delete).not.toBe(authenticated)
    })
  })

  describe('Chapters collection', () => {
    it('should use adminOnly for create, update, and delete operations', () => {
      expect(Chapters.access?.create).toBe(adminOnly)
      expect(Chapters.access?.update).toBe(adminOnly)
      expect(Chapters.access?.delete).toBe(adminOnly)
    })

    it('should NOT use anyone for read operation (fixed)', () => {
      expect(Chapters.access?.read).not.toBe(anyone)
    })

    it('should return true for authenticated users', () => {
      const mockReq = { user: { id: 'user-1', role: 'student' } } as any
      const result = Chapters.access?.read?.({ req: mockReq })
      expect(result).toBe(true)
    })

    it('should return status filter for anonymous users', () => {
      const mockReq = { user: null } as any
      const result = Chapters.access?.read?.({ req: mockReq })
      expect(result).toEqual({ status: { equals: 'published' } })
    })

    it('should NOT use authenticated for write operations', () => {
      expect(Chapters.access?.create).not.toBe(authenticated)
      expect(Chapters.access?.update).not.toBe(authenticated)
      expect(Chapters.access?.delete).not.toBe(authenticated)
    })
  })

  describe('Lessons collection', () => {
    it('should use adminOnly for create, update, and delete operations', () => {
      expect(Lessons.access?.create).toBe(adminOnly)
      expect(Lessons.access?.update).toBe(adminOnly)
      expect(Lessons.access?.delete).toBe(adminOnly)
    })

    it('should NOT use anyone for read operation (fixed)', () => {
      expect(Lessons.access?.read).not.toBe(anyone)
    })

    it('should return true for authenticated users', () => {
      const mockReq = { user: { id: 'user-1', role: 'student' } } as any
      const result = Lessons.access?.read?.({ req: mockReq })
      expect(result).toBe(true)
    })

    it('should return status filter for anonymous users', () => {
      const mockReq = { user: null } as any
      const result = Lessons.access?.read?.({ req: mockReq })
      expect(result).toEqual({ status: { equals: 'published' } })
    })

    it('should NOT use authenticated for write operations', () => {
      expect(Lessons.access?.create).not.toBe(authenticated)
      expect(Lessons.access?.update).not.toBe(authenticated)
      expect(Lessons.access?.delete).not.toBe(authenticated)
    })
  })

  describe('Categories collection', () => {
    it('should use adminOnly for create, update, and delete operations', () => {
      expect(Categories.access?.create).toBe(adminOnly)
      expect(Categories.access?.update).toBe(adminOnly)
      expect(Categories.access?.delete).toBe(adminOnly)
    })

    it('should use anyone for read operation (unchanged)', () => {
      expect(Categories.access?.read).toBe(anyone)
    })

    it('should NOT use authenticated for write operations', () => {
      expect(Categories.access?.create).not.toBe(authenticated)
      expect(Categories.access?.update).not.toBe(authenticated)
      expect(Categories.access?.delete).not.toBe(authenticated)
    })
  })

  describe('PricingPlans collection', () => {
    it('should use adminOnly for create, update, and delete operations', () => {
      expect(PricingPlans.access?.create).toBe(adminOnly)
      expect(PricingPlans.access?.update).toBe(adminOnly)
      expect(PricingPlans.access?.delete).toBe(adminOnly)
    })

    it('should use anyone for read operation (unchanged)', () => {
      expect(PricingPlans.access?.read).toBe(anyone)
    })

    it('should NOT use authenticated for write operations', () => {
      expect(PricingPlans.access?.create).not.toBe(authenticated)
      expect(PricingPlans.access?.update).not.toBe(authenticated)
      expect(PricingPlans.access?.delete).not.toBe(authenticated)
    })
  })

  describe('Media collection', () => {
    it('should use adminOnly for create, update, and delete operations', () => {
      expect(Media.access?.create).toBe(adminOnly)
      expect(Media.access?.update).toBe(adminOnly)
      expect(Media.access?.delete).toBe(adminOnly)
    })

    it('should use anyone for read operation (unchanged)', () => {
      expect(Media.access?.read).toBe(anyone)
    })

    it('should NOT use authenticated for write operations', () => {
      expect(Media.access?.create).not.toBe(authenticated)
      expect(Media.access?.update).not.toBe(authenticated)
      expect(Media.access?.delete).not.toBe(authenticated)
    })
  })

  describe('adminOnly access function behavior', () => {
    it('should reject non-admin users', () => {
      const mockReq = {
        user: { id: 'user-1', role: 'student' },
      } as any

      const result = adminOnly({ req: mockReq })
      expect(result).toBe(false)
    })

    it('should accept admin users', () => {
      const mockReq = {
        user: { id: 'user-1', role: 'admin' },
      } as any

      const result = adminOnly({ req: mockReq })
      expect(result).toBe(true)
    })

    it('should reject unauthenticated users', () => {
      const mockReq = {
        user: null,
      } as any

      const result = adminOnly({ req: mockReq })
      expect(result).toBe(false)
    })
  })
})
