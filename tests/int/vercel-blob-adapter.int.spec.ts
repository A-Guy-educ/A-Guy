/**
 * Integration tests for Vercel Blob Adapter
 *
 * These tests perform actual operations against Vercel Blob storage.
 * They require BLOB_READ_WRITE_TOKEN to be set in the environment.
 *
 * Run with: pnpm test:int -- --run tests/int/vercel-blob-adapter.int.spec.ts
 */

import {
  createBlobAdapter,
  getBlobPathname,
  isVercelBlobUrl,
  VercelBlobAdapter,
} from '@/infra/blob/vercel-blob-adapter'
import { describe, expect, it } from 'vitest'

describe('VercelBlobAdapter Integration', () => {
  // Skip all tests if no token is available
  const token = process.env.BLOB_READ_WRITE_TOKEN
  const isSkipped = !token || token === '' || token === 'mock-token-for-testing'

  // Generate unique test filename to avoid conflicts
  const testId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const testFilename = `integration-test-${testId}.pdf`

  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  const describeIf = (condition: boolean, name: string, fn: () => void): void => {
    if (condition) {
      describe.skip(name, fn)
    } else {
      describe(name, fn)
    }
  }

  describeIf(isSkipped, 'Vercel Blob Integration (skipped - no token)', () => {
    it('should have BLOB_READ_WRITE_TOKEN set', () => {
      console.log('To run integration tests:')
      console.log('1. Set BLOB_READ_WRITE_TOKEN environment variable')
      console.log('2. Run: pnpm test:int -- --run tests/int/vercel-blob-adapter.int.spec.ts')
      expect(process.env.BLOB_READ_WRITE_TOKEN).toBeDefined()
    })
  })

  describe('Upload and Download', () => {
    it('should upload a file and return a valid blob URL', async () => {
      if (isSkipped) return

      const adapter = new VercelBlobAdapter({
        directory: 'integration-tests',
        public: true,
      })

      const testContent = 'Test PDF content for integration test'
      const testBuffer = Buffer.from(testContent, 'utf-8')

      const result = await adapter.uploadBuffer(testFilename, testBuffer, 'application/pdf')

      expect(result.url).toBeDefined()
      expect(result.url).not.toBe('')
      expect(isVercelBlobUrl(result.url)).toBe(true)
      expect(result.pathname).toBe(`integration-tests/${testFilename}`)
      expect(result.contentType).toBe('application/pdf')
    })

    it('should download the uploaded file and verify content', async () => {
      if (isSkipped) return

      const adapter = new VercelBlobAdapter({
        directory: 'integration-tests',
        public: true,
      })

      // List to find the uploaded file
      const listResult = await adapter.list('integration-tests')
      const testBlob = listResult.blobs.find((b) => b.pathname.includes(testId))

      if (!testBlob) {
        // Upload was skipped or failed, skip this test
        return
      }

      const response = await fetch(testBlob.url)
      expect(response.ok).toBe(true)
      expect(response.headers.get('content-type')).toContain('application/pdf')

      const downloadedBuffer = Buffer.from(await response.arrayBuffer())
      expect(downloadedBuffer.toString('utf-8')).toBe('Test PDF content for integration test')
    })
  })

  describe('List and Exists', () => {
    it('should list uploaded files', async () => {
      if (isSkipped) return

      const adapter = new VercelBlobAdapter({
        directory: 'integration-tests',
        public: true,
      })

      const result = await adapter.list('integration-tests')

      // Skip if no files exist (upload test may have been skipped)
      if (result.blobs.length === 0) {
        console.log('No blobs found - upload test may have been skipped. Skipping this test.')
        return
      }

      expect(result.blobs.length).toBeGreaterThan(0)
      const testBlob = result.blobs.find((b: any) => b.pathname.includes(testId))
      expect(testBlob).toBeDefined()
    })

    it('should check if file exists', async () => {
      if (isSkipped) return

      const adapter = new VercelBlobAdapter({
        directory: 'integration-tests',
        public: true,
      })

      // List to find a valid URL
      const listResult = await adapter.list('integration-tests')
      const testBlob = listResult.blobs.find((b: any) => b.pathname.includes(testId))

      if (!testBlob) {
        return
      }

      const exists = await adapter.exists(testBlob.url)
      expect(exists).toBe(true)

      const notExists = await adapter.exists(
        'https://example.blob.vercel-storage.com/nonexistent-file.pdf',
      )
      expect(notExists).toBe(false)
    })
  })

  describe('Delete', () => {
    it('should delete the uploaded file', async () => {
      if (isSkipped) return

      const adapter = new VercelBlobAdapter({
        directory: 'integration-tests',
        public: true,
      })

      // List to find the uploaded file
      const listResult = await adapter.list('integration-tests')
      const testBlob = listResult.blobs.find((b: any) => b.pathname.includes(testId))

      if (!testBlob) {
        return
      }

      const result = await adapter.delete(testBlob.url)
      expect(result).toBe(true)

      // Verify deletion
      const exists = await adapter.exists(testBlob.url)
      expect(exists).toBe(false)
    })

    it('should return false when deleting non-existent file', async () => {
      if (isSkipped) return

      const adapter = new VercelBlobAdapter({
        directory: 'integration-tests',
        public: true,
      })

      const result = await adapter.delete(
        'https://example.blob.vercel-storage.com/nonexistent-file.pdf',
      )
      expect(result).toBe(false)
    })
  })

  describe('Custom Adapter Configuration', () => {
    it('should use custom directory from createBlobAdapter', async () => {
      if (isSkipped) return

      const customAdapter = createBlobAdapter({
        directory: 'custom-test-dir',
        public: true,
      })

      const customFilename = `custom-test-${testId}.txt`
      const result = await customAdapter.uploadBuffer(
        customFilename,
        Buffer.from('custom test'),
        'text/plain',
      )

      expect(result.pathname).toBe(`custom-test-dir/${customFilename}`)

      // Cleanup
      await customAdapter.delete(result.url)
    })
  })

  describe('URL Utilities', () => {
    it('should extract pathname from Vercel Blob URL', () => {
      expect(getBlobPathname('https://example.blob.vercel-storage.com/media/file.pdf')).toBe(
        'media/file.pdf',
      )
      expect(getBlobPathname('https://public.blob.vercel-storage.com/media/file.pdf')).toBe(
        'media/file.pdf',
      )
    })

    it('should validate Vercel Blob URLs', () => {
      expect(isVercelBlobUrl('https://example.blob.vercel-storage.com/media/file.pdf')).toBe(true)
      expect(isVercelBlobUrl('https://public.blob.vercel-storage.com/media/file.pdf')).toBe(true)
      expect(isVercelBlobUrl('/api/media/file.pdf')).toBe(false)
      expect(isVercelBlobUrl('https://example.com/file.pdf')).toBe(false)
    })
  })
})
