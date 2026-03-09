/**
 * @fileType unit-test
 * @domain media
 * @pattern access-control, security-bug-fix
 * @ai-summary Reproduction tests for ExerciseAssets access control security bug
 */

import { describe, it, expect } from 'vitest'

import { ExerciseAssets } from '@/server/payload/collections/ExerciseAssets'
import { adminOnly } from '@/server/payload/access/adminOnly'
import { anyone } from '@/server/payload/access/anyone'
import { authenticated } from '@/server/payload/access/authenticated'

describe('ExerciseAssets Access Control - Security Bug Fix', () => {
  // Get access control - should be defined
  const access = ExerciseAssets.access

  if (!access) {
    throw new Error('ExerciseAssets.access is not defined')
  }

  /**
   * BUG FIX: delete and update access control should use adminOnly, not authenticated
   *
   * Previously, any authenticated user (including students) could delete or modify
   * ANY exercise asset in the system, not just their own. This is a security vulnerability.
   *
   * FIX: Change delete and update to use adminOnly (admin role only).
   */

  describe('delete access should use adminOnly (not authenticated)', () => {
    it('should have adminOnly function for delete access', () => {
      // The bug: delete is set to authenticated
      // After fix: delete should reference adminOnly function
      expect(access.delete).toBe(adminOnly)
    })
  })

  describe('update access should use adminOnly (not authenticated)', () => {
    it('should have adminOnly function for update access', () => {
      // The bug: update is set to authenticated
      // After fix: update should reference adminOnly function
      expect(access.update).toBe(adminOnly)
    })
  })

  describe('create access should remain authenticated', () => {
    it('should have authenticated function for create access', () => {
      // Regression guard: create must stay as authenticated
      // since users need to upload assets
      expect(access.create).toBe(authenticated)
    })
  })

  describe('read access should remain anyone', () => {
    it('should have anyone function for read access', () => {
      // Regression guard: read must stay as anyone
      // since assets are rendered in student views
      expect(access.read).toBe(anyone)
    })
  })

  /**
   * Verify that adminOnly correctly rejects student users
   */
  describe('adminOnly access function behavior', () => {
    it('should reject student users', () => {
      // Mock request with student role - using 'as any' pattern
      const mockReq = {
        user: { id: 'user-123', role: 'student' },
      } as any

      // adminOnly should return false for student users
      const result = adminOnly({ req: mockReq })
      expect(result).toBe(false)
    })

    it('should allow admin users', () => {
      // Mock request with admin role
      const mockReq = {
        user: { id: 'admin-123', role: 'admin' },
      } as any

      // adminOnly should return true for admin users
      const result = adminOnly({ req: mockReq })
      expect(result).toBe(true)
    })

    it('should reject unauthenticated requests', () => {
      // Mock request without user
      const mockReq = {
        user: null,
      } as any

      // adminOnly should return false for unauthenticated requests
      const result = adminOnly({ req: mockReq })
      expect(result).toBe(false)
    })
  })
})
