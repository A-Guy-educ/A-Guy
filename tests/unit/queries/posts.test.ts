import {
  queryAllPostSlugs,
  queryAllPostsForSitemap,
  queryPostBySlug,
  queryPublishedPosts,
  searchPosts,
} from '@/server/repos/queries/posts'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

// Mock Payload
vi.mock('payload', () => ({
  getPayload: vi.fn(),
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

type MockPayload = {
  find: Mock
}

describe('Post Queries', () => {
  describe('queryPostBySlug', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('returns post when found', async () => {
      const mockPost = {
        id: 'post-1',
        title: 'Test Post',
        slug: 'test-post',
        contentJson: [{ type: 'paragraph', text: 'Hello' }],
        author: { id: 'user-1', name: 'Test Author' },
      }

      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [mockPost] }),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryPostBySlug({ slug: 'test-post' })

      expect(result).toEqual(mockPost)
      expect(mockPayload.find).toHaveBeenCalledWith({
        collection: 'posts',
        where: { slug: { equals: 'test-post' } },
        limit: 1,
        pagination: false,
        depth: 2,
      })
    })

    it('returns null when post not found', async () => {
      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryPostBySlug({ slug: 'non-existent' })

      expect(result).toBeNull()
    })
  })

  describe('queryPublishedPosts', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('returns published posts with pagination result', async () => {
      const mockResult = {
        docs: [
          { id: 'post-1', title: 'Post 1', slug: 'post-1' },
          { id: 'post-2', title: 'Post 2', slug: 'post-2' },
        ],
        totalDocs: 2,
        page: 1,
        totalPages: 1,
      }

      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue(mockResult),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryPublishedPosts({ page: 1, limit: 10 })

      expect(result).toEqual(mockResult)
      expect(mockPayload.find).toHaveBeenCalledWith({
        collection: 'posts',
        where: { status: { equals: 'published' } },
        sort: '-createdAt',
        page: 1,
        limit: 10,
        depth: 2,
      })
    })

    it('uses default pagination when not provided', async () => {
      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      await queryPublishedPosts({})

      expect(mockPayload.find).toHaveBeenCalledWith({
        collection: 'posts',
        where: { status: { equals: 'published' } },
        sort: '-createdAt',
        page: 1,
        limit: 12,
        depth: 2,
      })
    })

    it('returns result object with empty docs when no posts found', async () => {
      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryPublishedPosts({ page: 1, limit: 10 })

      expect(result).toEqual({ docs: [], totalDocs: 0 })
    })
  })

  describe('searchPosts', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('returns posts matching search query', async () => {
      const mockResult = {
        docs: [
          { id: 'post-1', title: 'TypeScript Guide', slug: 'typescript-guide' },
          { id: 'post-2', title: 'TypeScript Best Practices', slug: 'ts-best-practices' },
        ],
        totalDocs: 2,
      }

      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue(mockResult),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await searchPosts({ query: 'TypeScript', limit: 10 })

      expect(result).toEqual(mockResult)
      expect(mockPayload.find).toHaveBeenCalledWith({
        collection: 'posts',
        where: {
          or: [
            { title: { like: 'TypeScript' } },
            { 'meta.description': { like: 'TypeScript' } },
            { 'meta.title': { like: 'TypeScript' } },
            { slug: { like: 'TypeScript' } },
          ],
        },
        limit: 10,
        depth: 1,
        select: {
          title: true,
          slug: true,
          categories: true,
          meta: true,
        },
      })
    })

    it('returns result object with empty docs when no matches found', async () => {
      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await searchPosts({ query: 'nonexistent' })

      expect(result).toEqual({ docs: [], totalDocs: 0 })
    })

    it('uses default limit when not provided', async () => {
      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      await searchPosts({ query: 'test' })

      expect(mockPayload.find).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 12,
        }),
      )
    })
  })

  describe('queryAllPostSlugs', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('returns all post slugs as objects', async () => {
      const mockPosts = [
        { id: 'post-1', slug: 'post-1' },
        { id: 'post-2', slug: 'post-2' },
        { id: 'post-3', slug: 'post-3' },
      ]

      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: mockPosts }),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryAllPostSlugs()

      expect(result).toEqual([{ slug: 'post-1' }, { slug: 'post-2' }, { slug: 'post-3' }])
      expect(mockPayload.find).toHaveBeenCalledWith({
        collection: 'posts',
        depth: 0,
        draft: false,
        limit: 25,
        select: { slug: true },
      })
    })

    it('returns empty array when no posts exist', async () => {
      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryAllPostSlugs()

      expect(result).toEqual([])
    })
  })

  describe('queryAllPostsForSitemap', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('returns published posts with slug and updatedAt', async () => {
      const mockPosts = [
        { id: 'post-1', slug: 'post-1', updatedAt: '2024-01-01' },
        { id: 'post-2', slug: 'post-2', updatedAt: '2024-01-02' },
      ]

      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: mockPosts }),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryAllPostsForSitemap()

      expect(result).toEqual(mockPosts)
      expect(mockPayload.find).toHaveBeenCalledWith({
        collection: 'posts',
        where: { status: { equals: 'published' } },
        select: { slug: true, updatedAt: true },
        limit: 1000,
        pagination: false,
      })
    })
  })
})
