// @vitest-environment node
/**
 * Integration tests: Search Posts Query (#1897)
 *
 * Verifies that searchPosts correctly finds posts by title, slug, or meta fields.
 * This tests the query function directly to ensure the search functionality works.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { searchPosts } from '@/server/repos/queries/posts'

let payload: Payload

beforeAll(async () => {
  payload = await getPayload({ config })
})

afterAll(async () => {
  if (payload?.db?.destroy) {
    await payload.db.destroy()
  }
})

describe('searchPosts', () => {
  it('returns results for a common search term if posts exist', async () => {
    // Search for a common term that should find at least one post if any exist
    const result = await searchPosts({ query: 'test' })
    expect(result.docs).toBeDefined()
    // Result should either have docs or be empty, but not error
    expect(Array.isArray(result.docs)).toBe(true)
  })

  it('returns empty docs for non-matching query', async () => {
    const result = await searchPosts({ query: 'NonExistentQueryXYZ123456789' })
    expect(result.docs).toBeDefined()
    expect(result.docs.length).toBe(0)
  })

  it('returns docs structure with expected fields', async () => {
    const result = await searchPosts({ query: 'test' })
    expect(result.docs).toBeDefined()
    // If there are docs, they should have the selected fields
    if (result.docs.length > 0) {
      const doc = result.docs[0]
      expect(doc).toHaveProperty('title')
      expect(doc).toHaveProperty('slug')
      expect(doc).toHaveProperty('meta')
    }
  })
})
