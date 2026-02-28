/**
 * @fileType unit-test
 * @domain media
 * @pattern serverless-compatibility, admin-thumbnail-fix
 * @ai-summary Reproduction test for ExerciseAssets collection configuration bugs
 */

import { describe, it, expect } from 'vitest'

import { ExerciseAssets } from '@/server/payload/collections/ExerciseAssets'

// Type guard to check if upload config is an object (not false)
function isUploadConfig(upload: unknown): upload is {
  staticDir?: string
  adminThumbnail?: ((args: { doc: { url?: string | null } }) => string | null | false) | string
  mimeTypes?: string[]
  imageSizes?: Array<{ name: string; width?: number; height?: number; position?: string }>
} {
  return typeof upload === 'object' && upload !== null && !Array.isArray(upload)
}

describe('ExerciseAssets Collection Configuration - Bug Reproduction', () => {
  // Get upload config with type guard
  const uploadConfig = isUploadConfig(ExerciseAssets.upload) ? ExerciseAssets.upload : null

  /**
   * BUG 1: staticDir is used which doesn't work in serverless environments
   *
   * The collection uses `staticDir: 'exercise-assets'` which stores files on the local
   * filesystem. In serverless environments (Vercel, AWS Lambda, etc.), the local filesystem
   * is ephemeral and files are not persisted between invocations.
   *
   * FIX: Remove staticDir and use blob storage adapter instead.
   */

  describe('staticDir should NOT be used (serverless compatibility)', () => {
    it('should NOT have staticDir configured (use blob adapter instead)', () => {
      // The bug is: staticDir: 'exercise-assets' exists
      // After fix: staticDir should be undefined (no local filesystem storage)
      expect(uploadConfig?.staticDir).toBeUndefined()
    })
  })

  /**
   * BUG 2: adminThumbnail is set to 'thumbnail' string but imageSizes are commented out
   *
   * The collection has `adminThumbnail: 'thumbnail'` which references an image size
   * that doesn't exist because imageSizes are commented out:
   *
   * ```javascript
   * // imageSizes: [
   * //   { name: 'thumbnail', width: 400, height: 300, position: 'centre' },
   * // ],
   * adminThumbnail: 'thumbnail',  // This references a non-existent size!
   * ```
   *
   * FIX: Change adminThumbnail to a function that returns the original file URL
   * since we're not generating resized images.
   */

  describe('adminThumbnail should be a function (not a string reference)', () => {
    it('should have adminThumbnail as a function, not a string', () => {
      // The bug is: adminThumbnail: 'thumbnail' (string)
      // After fix: adminThumbnail should be a function that returns the file URL
      const adminThumbnail = uploadConfig?.adminThumbnail

      expect(typeof adminThumbnail).toBe('function')
    })

    it('should return the original file URL when adminThumbnail function is called', () => {
      const adminThumbnail = uploadConfig?.adminThumbnail

      // Type guard - ensure adminThumbnail exists and is a function
      if (!adminThumbnail || typeof adminThumbnail !== 'function') {
        throw new Error('adminThumbnail should be a function')
      }

      // Test the function behavior with a mock document
      const mockDoc = {
        url: 'https://example.blob.com/exercise-assets/image.svg',
      }

      const result = adminThumbnail({ doc: mockDoc })

      // Should return the original URL
      expect(result).toBe(mockDoc.url)
    })

    it('should handle documents without URL', () => {
      const adminThumbnail = uploadConfig?.adminThumbnail

      // Type guard - ensure adminThumbnail exists and is a function
      if (!adminThumbnail || typeof adminThumbnail !== 'function') {
        throw new Error('adminThumbnail should be a function')
      }

      // Test with no URL
      const mockDoc = {
        url: null,
      }

      const result = adminThumbnail({ doc: mockDoc })

      // Should return false to disable thumbnail (or null)
      expect(result).toBeFalsy()
    })

    it('should NOT use string reference to non-existent imageSize', () => {
      // This test explicitly checks that adminThumbnail is NOT a string
      // because 'thumbnail' references an imageSize that doesn't exist
      const adminThumbnail = uploadConfig?.adminThumbnail

      expect(adminThumbnail).not.toBe('thumbnail')
    })
  })

  /**
   * Verify other upload configuration is correct
   */

  describe('other upload configuration', () => {
    it('should allow SVG and PNG mime types', () => {
      expect(uploadConfig?.mimeTypes).toContain('image/svg+xml')
      expect(uploadConfig?.mimeTypes).toContain('image/png')
    })

    it('should have access control configured', () => {
      expect(ExerciseAssets.access).toBeDefined()
      expect(ExerciseAssets.access?.read).toBeDefined()
      expect(ExerciseAssets.access?.create).toBeDefined()
      expect(ExerciseAssets.access?.update).toBeDefined()
      expect(ExerciseAssets.access?.delete).toBeDefined()
    })

    it('should have alt and caption fields', () => {
      const fieldNames =
        ExerciseAssets.fields?.map((f) => (f as { name?: string }).name).filter(Boolean) || []
      expect(fieldNames).toContain('alt')
      expect(fieldNames).toContain('caption')
    })
  })
})
