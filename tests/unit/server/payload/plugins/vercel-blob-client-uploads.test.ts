/**
 * Unit Tests for Vercel Blob clientUploads Access Function
 *
 * Tests the access control logic for direct browser-to-blob uploads.
 * This function determines whether a user can perform client-side uploads
 * to the media or exercise-assets collections.
 */
import { describe, expect, it } from 'vitest'

// Extract the access function logic for testing
// This mirrors the implementation in src/server/payload/plugins/index.ts
const clientUploadsAccess = ({
  req,
  collectionSlug,
}: {
  req: { user: unknown }
  collectionSlug: string
}): boolean => {
  const user = req.user
  if (!user || typeof user !== 'object') return false

  // Check if user has role property
  const hasRole = 'role' in user
  const role = hasRole ? (user as { role?: string }).role : undefined

  if (!role) return false

  // exercise-assets: any authenticated user can upload (create access: authenticated, but delete/update: adminOnly)
  if (collectionSlug === 'exercise-assets') return true
  // media: admin only (matches collection access: adminOnly)
  return role === 'admin'
}

describe('clientUploads access function', () => {
  describe('user validation', () => {
    it('returns false when user is null', () => {
      const result = clientUploadsAccess({
        req: { user: null },
        collectionSlug: 'media',
      })
      expect(result).toBe(false)
    })

    it('returns false when user is undefined', () => {
      const result = clientUploadsAccess({
        req: { user: undefined },
        collectionSlug: 'media',
      })
      expect(result).toBe(false)
    })

    it('returns false when user is not an object', () => {
      const result = clientUploadsAccess({
        req: { user: 'string' as unknown },
        collectionSlug: 'media',
      })
      expect(result).toBe(false)
    })

    it('returns false when user object does not have role property', () => {
      const result = clientUploadsAccess({
        req: { user: { id: '123', email: 'test@example.com' } },
        collectionSlug: 'media',
      })
      expect(result).toBe(false)
    })

    it('returns false when role is undefined', () => {
      const result = clientUploadsAccess({
        req: { user: { id: '123', role: undefined } },
        collectionSlug: 'media',
      })
      expect(result).toBe(false)
    })
  })

  describe('exercise-assets collection', () => {
    it('returns true for exercise-assets when user has student role', () => {
      const result = clientUploadsAccess({
        req: { user: { id: '123', role: 'student' } },
        collectionSlug: 'exercise-assets',
      })
      expect(result).toBe(true)
    })

    it('returns true for exercise-assets when user has admin role', () => {
      const result = clientUploadsAccess({
        req: { user: { id: '123', role: 'admin' } },
        collectionSlug: 'exercise-assets',
      })
      expect(result).toBe(true)
    })
  })

  describe('media collection', () => {
    it('returns true for media when user has admin role', () => {
      const result = clientUploadsAccess({
        req: { user: { id: '123', role: 'admin' } },
        collectionSlug: 'media',
      })
      expect(result).toBe(true)
    })

    it('returns false for media when user has student role', () => {
      const result = clientUploadsAccess({
        req: { user: { id: '123', role: 'student' } },
        collectionSlug: 'media',
      })
      expect(result).toBe(false)
    })

    it('returns false for media when role is invalid', () => {
      const result = clientUploadsAccess({
        req: { user: { id: '123', role: 'invalid' } },
        collectionSlug: 'media',
      })
      expect(result).toBe(false)
    })
  })
})
