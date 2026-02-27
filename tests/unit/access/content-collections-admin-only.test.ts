/**
 * @fileType unit-test
 * @domain access-control
 * @pattern security-fix
 * @ai-summary Reproduction test to verify content collections use adminOnly for write operations
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
import { publishedOrAuthenticated } from '@/server/payload/access/publishedOrAuthenticated'

describe('Content Collections Access Control - Bug Reproduction', () => {
  /**
   * This test verifies that content-management collections use adminOnly for CUD operations.
   *
   * BUG: Currently these collections use `authenticated` which allows ANY logged-in user
   * (including students) to create, update, and delete administrative content.
   *
   * FIX: Replace `authenticated` with `adminOnly` for create, update, delete operations.
   */

  describe('Courses collection', () => {
    it('should use adminOnly for create, update, and delete operations', () => {
      expect(Courses.access?.create).toBe(adminOnly)
      expect(Courses.access?.update).toBe(adminOnly)
      expect(Courses.access?.delete).toBe(adminOnly)
    })

    it('should use publishedOrAuthenticated for read operation (status-filtered)', () => {
      expect(Courses.access?.read).toBe(publishedOrAuthenticated)
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

    it('should use publishedOrAuthenticated for read operation (status-filtered)', () => {
      expect(Chapters.access?.read).toBe(publishedOrAuthenticated)
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

    it('should use publishedOrAuthenticated for read operation (status-filtered)', () => {
      expect(Lessons.access?.read).toBe(publishedOrAuthenticated)
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
