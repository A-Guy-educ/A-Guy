import {
  queryAllPageSlugs,
  queryAllPagesForSitemap,
  queryPageBySlug,
  queryPublishedPages,
} from '@/server/repos/queries/pages'
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

describe('Page Queries', () => {
  describe('queryPageBySlug', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('returns page when found', async () => {
      const mockPage = {
        id: 'page-1',
        title: 'Test Page',
        slug: 'test-page',
        contentJson: [{ type: 'paragraph', text: 'Hello' }],
      }

      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [mockPage] }),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryPageBySlug({ slug: 'test-page' })

      expect(result).toEqual(mockPage)
      expect(mockPayload.find).toHaveBeenCalledWith({
        collection: 'pages',
        where: { slug: { equals: 'test-page' } },
        limit: 1,
        pagination: false,
        depth: 2,
      })
    })

    it('returns null when page not found', async () => {
      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryPageBySlug({ slug: 'non-existent' })

      expect(result).toBeNull()
    })

    it('uses correct query parameters', async () => {
      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      await queryPageBySlug({ slug: 'test-slug' })

      expect(mockPayload.find).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'pages',
          where: { slug: { equals: 'test-slug' } },
          limit: 1,
          pagination: false,
          depth: 2,
        }),
      )
    })
  })

  describe('queryPublishedPages', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('returns published pages as array', async () => {
      const mockPages = [
        { id: 'page-1', title: 'Page 1', slug: 'page-1' },
        { id: 'page-2', title: 'Page 2', slug: 'page-2' },
      ]

      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: mockPages }),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryPublishedPages()

      expect(result).toEqual(mockPages)
      expect(mockPayload.find).toHaveBeenCalledWith({
        collection: 'pages',
        where: { status: { equals: 'published' } },
        sort: 'publishedAt',
        limit: 1000,
        pagination: false,
        depth: 2,
      })
    })

    it('returns empty array when no pages found', async () => {
      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryPublishedPages()

      expect(result).toEqual([])
    })
  })

  describe('queryAllPageSlugs', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('returns all page slugs excluding home', async () => {
      const mockPages = [
        { id: 'page-1', slug: 'page-1' },
        { id: 'page-2', slug: 'home' },
        { id: 'page-3', slug: 'page-3' },
      ]

      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: mockPages }),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryAllPageSlugs()

      expect(result).toEqual([{ slug: 'page-1' }, { slug: 'page-3' }])
      expect(mockPayload.find).toHaveBeenCalledWith({
        collection: 'pages',
        depth: 0,
        draft: false,
        limit: 25,
        select: { slug: true },
      })
    })

    it('returns empty array when no pages exist', async () => {
      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryAllPageSlugs()

      expect(result).toEqual([])
    })
  })

  describe('queryAllPagesForSitemap', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('returns pages with slug and updatedAt', async () => {
      const mockPages = [
        { id: 'page-1', slug: 'page-1', updatedAt: '2024-01-01' },
        { id: 'page-2', slug: 'page-2', updatedAt: '2024-01-02' },
      ]

      const { getPayload } = await import('payload')
      const mockPayload: MockPayload = {
        find: vi.fn().mockResolvedValue({ docs: mockPages }),
      }
      ;(getPayload as Mock).mockResolvedValue(mockPayload)

      const result = await queryAllPagesForSitemap()

      expect(result).toEqual(mockPages)
      expect(mockPayload.find).toHaveBeenCalledWith({
        collection: 'pages',
        where: { status: { equals: 'published' } },
        select: { slug: true, updatedAt: true },
        limit: 1000,
        pagination: false,
      })
    })
  })
})
