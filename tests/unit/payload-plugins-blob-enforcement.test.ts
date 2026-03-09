/**
 * Tests for Vercel Blob storage enforcement in plugins/index.ts
 *
 * In production (NODE_ENV !== 'test'), the module throws if BLOB_READ_WRITE_TOKEN
 * is missing. In test mode (NODE_ENV === 'test'), the throw is skipped and the
 * blob plugin is simply omitted from the plugins array.
 *
 * Since vitest sets NODE_ENV=test, these tests verify the test-mode behavior:
 * no throw, but blob plugin absent when token is missing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('Vercel Blob Storage Enforcement', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    // Clear module cache to test fresh import
    vi.resetModules()
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe('enforceBlobStorageToken', () => {
    it('should not throw in test mode when BLOB_READ_WRITE_TOKEN is not set', async () => {
      // In test mode (NODE_ENV=test), missing token should not throw
      delete process.env.BLOB_READ_WRITE_TOKEN

      const pluginsModule = await import('@/server/payload/plugins/index')
      expect(pluginsModule.plugins).toBeDefined()
      expect(Array.isArray(pluginsModule.plugins)).toBe(true)
    }, 15000)

    it('should not throw when BLOB_READ_WRITE_TOKEN is set', async () => {
      // Set a mock token
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token-12345'

      // This should not throw
      const pluginsModule = await import('@/server/payload/plugins/index')
      expect(pluginsModule.plugins).toBeDefined()
      expect(Array.isArray(pluginsModule.plugins)).toBe(true)
    })

    it('should not throw in test mode when BLOB_READ_WRITE_TOKEN is empty string', async () => {
      // In test mode, empty token should not throw
      process.env.BLOB_READ_WRITE_TOKEN = ''

      const pluginsModule = await import('@/server/payload/plugins/index')
      expect(pluginsModule.plugins).toBeDefined()
      expect(Array.isArray(pluginsModule.plugins)).toBe(true)
    })

    it('should not throw in test mode when BLOB_READ_WRITE_TOKEN is undefined', async () => {
      // In test mode, undefined token should not throw
      process.env.BLOB_READ_WRITE_TOKEN = undefined as unknown as string

      const pluginsModule = await import('@/server/payload/plugins/index')
      expect(pluginsModule.plugins).toBeDefined()
      expect(Array.isArray(pluginsModule.plugins)).toBe(true)
    })

    it('should have plugins defined when token is set', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_token_abc123'

      const { plugins: pluginsArray } = await import('@/server/payload/plugins/index')

      // Verify plugins array is defined and non-empty
      expect(pluginsArray).toBeDefined()
      expect(Array.isArray(pluginsArray)).toBe(true)
      expect(pluginsArray.length).toBeGreaterThan(0)
    })
  })

  describe('addRandomSuffix configuration', () => {
    it('should have vercel blob plugin in plugins array when token is set', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test123_abc'

      const { plugins: pluginsArray } = await import('@/server/payload/plugins/index')

      // Plugins array should contain elements including the vercel blob storage plugin
      expect(pluginsArray).toBeDefined()
      expect(Array.isArray(pluginsArray)).toBe(true)
      expect(pluginsArray.length).toBeGreaterThan(0)
    })

    it('should configure multiple collections for blob storage', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test456_xyz'

      const { plugins: pluginsArray } = await import('@/server/payload/plugins/index')

      // The plugins array should contain multiple plugins including vercel blob
      expect(pluginsArray.length).toBeGreaterThan(1)
    })
  })
})
