/**
 * Integration tests for Media Upload via Vercel Blob
 *
 * Tests the blob upload/delete lifecycle.
 * Requires BLOB_READ_WRITE_TOKEN to be set.
 *
 * Run with: pnpm test:int -- --run tests/int/media-upload-flow.int.spec.ts
 */

import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { VercelBlobAdapter } from '@/infra/blob/vercel-blob-adapter'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let originalDatabaseUrl: string | undefined
const TEST_BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN
// Valid tokens are longer than what mock/test tokens look like
// Real Vercel tokens are 60+ chars
const shouldRun =
  TEST_BLOB_TOKEN && TEST_BLOB_TOKEN.length > 60 && TEST_BLOB_TOKEN.startsWith('vercel_blob_rw_')
// Generate unique test prefix
const testPrefix = `int-test-${Date.now()}`

// Only run tests if we have a valid token
if (!shouldRun) {
  describe.skip('Vercel Blob Media Upload (skipped - no valid token)', () => {
    it('requires valid BLOB_READ_WRITE_TOKEN', () => {
      expect(process.env.BLOB_READ_WRITE_TOKEN).toBeDefined()
    })
  })
} else {
  describe('Vercel Blob Media Upload', () => {
    const adapter = new VercelBlobAdapter({
      directory: 'integration-tests',
      public: true,
    })

    beforeAll(async () => {
      originalDatabaseUrl = process.env.DATABASE_URL

      // @ts-expect-error - TypeScript doesn't allow delete on process.env
      delete process.env.DATABASE_URL

      const mongoUri = await startMongoContainer()
      process.env.DATABASE_URL = mongoUri
    }, 120000)

    afterAll(async () => {
      if (originalDatabaseUrl) {
        process.env.DATABASE_URL = originalDatabaseUrl
      }

      await stopMongoContainer()
    })

    it('should upload an image to Vercel Blob', async () => {
      const filename = `image-${testPrefix}.png`
      const pngBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const buffer = Buffer.from(pngBase64, 'base64')

      const result = await adapter.uploadBuffer(filename, buffer, 'image/png')

      expect(result.url).toBeDefined()
      expect(result.url).toContain('blob.vercel-storage.com')
      // Filename includes random suffix, so just check it contains our prefix
      expect(result.url).toContain('image-' + testPrefix)

      // Cleanup immediately
      await adapter.delete(result.url)
    })

    it('should upload and delete a PDF from Vercel Blob', async () => {
      const filename = `doc-${testPrefix}.pdf`
      const buffer = Buffer.from('%PDF-1.4 test content', 'utf-8')

      // Upload
      const result = await adapter.uploadBuffer(filename, buffer, 'application/pdf')
      expect(result.url).toBeDefined()

      // Wait a moment for blob to be available
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // List files and find our blob
      const listResult = await adapter.list()
      const ourBlob = listResult.blobs.find((b) => b.url.includes(filename))

      // Delete the blob
      if (ourBlob) {
        const deleted = await adapter.delete(ourBlob.url)
        expect(deleted).toBe(true)
      } else {
        // Fallback: try deleting using result.url
        await adapter.delete(result.url)
      }
    })

    it('should list files in the directory', async () => {
      const filename = `list-${testPrefix}.txt`
      const buffer = Buffer.from('test', 'utf-8')

      // Upload a file
      const result = await adapter.uploadBuffer(filename, buffer, 'text/plain')

      // List files - call without prefix to get all files in the configured directory
      const listResult = await adapter.list()
      expect(listResult.blobs).toBeDefined()
      // May have files from previous tests
      expect(listResult.blobs.length).toBeGreaterThanOrEqual(1)

      // Cleanup
      await adapter.delete(result.url)
    })
  })
}
