/**
 * Tests for Vercel Blob storage enforcement in plugins/index.ts
 *
 * This ensures that the application throws an error at startup if
 * BLOB_READ_WRITE_TOKEN is not configured, preventing silent fallback
 * to local storage which causes 401 errors.
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
    it('should throw error when BLOB_READ_WRITE_TOKEN is not set', async () => {
      // Dynamic import of plugins module can be slow due to transitive dependencies
      // Ensure token is not set
      delete process.env.BLOB_READ_WRITE_TOKEN

      // Import the module fresh - this will trigger the enforcement
      await expect(async () => {
        await import('@/server/payload/plugins/index')
      }).rejects.toThrow(
        'BLOB_READ_WRITE_TOKEN environment variable is required. ' +
          'Vercel Blob storage is mandatory for this application. ' +
          'Please set BLOB_READ_WRITE_TOKEN in your environment configuration.',
      )
    }, 15000)

    it('should not throw when BLOB_READ_WRITE_TOKEN is set', async () => {
      // Set a mock token
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token-12345'

      // This should not throw
      const pluginsModule = await import('@/server/payload/plugins/index')
      expect(pluginsModule.plugins).toBeDefined()
      expect(Array.isArray(pluginsModule.plugins)).toBe(true)
    })

    it('should throw error when BLOB_READ_WRITE_TOKEN is empty string', async () => {
      // Set empty string token
      process.env.BLOB_READ_WRITE_TOKEN = ''

      await expect(async () => {
        await import('@/server/payload/plugins/index')
      }).rejects.toThrow(
        'BLOB_READ_WRITE_TOKEN environment variable is required. ' +
          'Vercel Blob storage is mandatory for this application. ' +
          'Please set BLOB_READ_WRITE_TOKEN in your environment configuration.',
      )
    })

    it('should throw error when BLOB_READ_WRITE_TOKEN is undefined', async () => {
      // Explicitly set to undefined
      process.env.BLOB_READ_WRITE_TOKEN = undefined as unknown as string

      await expect(async () => {
        await import('@/server/payload/plugins/index')
      }).rejects.toThrow(
        'BLOB_READ_WRITE_TOKEN environment variable is required. ' +
          'Vercel Blob storage is mandatory for this application. ' +
          'Please set BLOB_READ_WRITE_TOKEN in your environment configuration.',
      )
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
})
