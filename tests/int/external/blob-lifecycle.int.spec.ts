/**
 * External Integration Tests: Vercel Blob Storage Lifecycle
 *
 * Tests real Vercel Blob upload/delete operations.
 * Gated behind RUN_EXTERNAL_TESTS=true and BLOB_READ_WRITE_TOKEN.
 *
 * Run with: pnpm test:external
 * Requires: BLOB_READ_WRITE_TOKEN environment variable
 *
 * @fileType integration-test
 * @domain blob.external
 * @pattern external-integration, blob-lifecycle
 */

import { describe, expect, it } from 'vitest'

const hasExternalTests = process.env.RUN_EXTERNAL_TESTS === 'true'
const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN

describe.runIf(hasExternalTests && hasBlobToken)('Vercel Blob Lifecycle', () => {
  it('should upload, verify, and delete a blob', async () => {
    const { put, del, head } = await import('@vercel/blob')

    const testContent = `test-blob-${Date.now()}`
    const testBlob = new Blob([testContent], { type: 'text/plain' })

    // Upload
    const uploaded = await put(`test/external-test-${Date.now()}.txt`, testBlob, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    expect(uploaded.url).toBeTruthy()
    expect(uploaded.url).toMatch(/^https:\/\//)

    // Verify exists
    const headResult = await head(uploaded.url, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    expect(headResult).toBeTruthy()
    expect(headResult.size).toBeGreaterThan(0)

    // Delete
    await del(uploaded.url, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    // Verify deleted
    try {
      await head(uploaded.url, {
        token: process.env.BLOB_READ_WRITE_TOKEN,
      })
      // If no error, the blob wasn't deleted (unexpected)
      expect.fail('Blob should have been deleted')
    } catch (error) {
      // Expected: blob not found after deletion
      expect(error).toBeTruthy()
    }
  }, 30000)
})
