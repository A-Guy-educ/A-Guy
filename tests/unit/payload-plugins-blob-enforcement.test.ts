/**
 * Tests for Vercel Blob storage enforcement in plugins/index.ts
 *
 * This ensures that the application throws an error at startup if
 * BLOB_READ_WRITE_TOKEN is not configured, preventing silent fallback
 * to local storage which causes 401 errors.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { enforceBlobStorageToken } from '@/server/payload/plugins/index'

describe('Vercel Blob Storage Enforcement', () => {
  let originalBlobToken: string | undefined
  let originalGenerateTypes: string | undefined

  beforeEach(() => {
    originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN
    originalGenerateTypes = process.env.PAYLOAD_GENERATE_TYPES
  })

  afterEach(() => {
    if (originalBlobToken !== undefined) {
      process.env.BLOB_READ_WRITE_TOKEN = originalBlobToken
    } else {
      delete process.env.BLOB_READ_WRITE_TOKEN
    }
    if (originalGenerateTypes !== undefined) {
      process.env.PAYLOAD_GENERATE_TYPES = originalGenerateTypes
    } else {
      delete process.env.PAYLOAD_GENERATE_TYPES
    }
  })

  describe('enforceBlobStorageToken', () => {
    it('should throw error when BLOB_READ_WRITE_TOKEN is not set', () => {
      delete process.env.BLOB_READ_WRITE_TOKEN
      delete process.env.PAYLOAD_GENERATE_TYPES

      expect(() => enforceBlobStorageToken()).toThrow(
        'BLOB_READ_WRITE_TOKEN environment variable is required. ' +
          'Vercel Blob storage is mandatory for this application. ' +
          'Please set BLOB_READ_WRITE_TOKEN in your environment configuration.',
      )
    })

    it('should not throw when BLOB_READ_WRITE_TOKEN is set', () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token-12345'
      delete process.env.PAYLOAD_GENERATE_TYPES

      expect(() => enforceBlobStorageToken()).not.toThrow()
    })

    it('should throw error when BLOB_READ_WRITE_TOKEN is empty string', () => {
      process.env.BLOB_READ_WRITE_TOKEN = ''
      delete process.env.PAYLOAD_GENERATE_TYPES

      expect(() => enforceBlobStorageToken()).toThrow(
        'BLOB_READ_WRITE_TOKEN environment variable is required.',
      )
    })

    it('should return the token string when valid', () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test123_abc'
      delete process.env.PAYLOAD_GENERATE_TYPES

      const result = enforceBlobStorageToken()
      expect(result).toBe('vercel_blob_rw_test123_abc')
    })

    it('should return null when PAYLOAD_GENERATE_TYPES is true', () => {
      delete process.env.BLOB_READ_WRITE_TOKEN
      process.env.PAYLOAD_GENERATE_TYPES = 'true'

      const result = enforceBlobStorageToken()
      expect(result).toBeNull()
    })

    it('should still enforce when PAYLOAD_GENERATE_TYPES is false', () => {
      delete process.env.BLOB_READ_WRITE_TOKEN
      process.env.PAYLOAD_GENERATE_TYPES = 'false'

      expect(() => enforceBlobStorageToken()).toThrow(
        'BLOB_READ_WRITE_TOKEN environment variable is required.',
      )
    })
  })
})
