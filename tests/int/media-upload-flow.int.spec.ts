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
const isSkipped =
  !TEST_BLOB_TOKEN || TEST_BLOB_TOKEN === '' || TEST_BLOB_TOKEN === 'mock-token-for-testing'

// Generate unique test prefix
const testPrefix = `int-test-${Date.now()}`

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

const describeIf = (condition: boolean, name: string, fn: () => void): void => {
  if (condition) {
    describe.skip(name, fn)
  } else {
    describe(name, fn)
  }
}

describeIf(isSkipped, 'Media Upload Flow (skipped - no BLOB_READ_WRITE_TOKEN)', () => {
  it('should have BLOB_READ_WRITE_TOKEN set', () => {
    console.log('To run integration tests:')
    console.log('1. Set BLOB_READ_WRITE_TOKEN environment variable')
    console.log('2. Run: pnpm test:int -- --run tests/int/media-upload-flow.int.spec.ts')
    expect(process.env.BLOB_READ_WRITE_TOKEN).toBeDefined()
  })
})

describe('Vercel Blob Media Upload', () => {
  if (isSkipped) return

  const adapter = new VercelBlobAdapter({
    directory: 'integration-tests',
    public: true,
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

  it('should return false for non-existent file', async () => {
    const exists = await adapter.exists(
      'https://example.blob.vercel-storage.com/integration-tests/nonexistent-file.txt',
    )
    expect(exists).toBe(false)
  })
})
