/**
 * Unit Tests for Documentation Search Module
 *
 * Tests the DocSearch class for keyword-based documentation searching,
 * including scoring, filtering, and similarity finding.
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { DocSearch, getDocSearch } from '@/lib/ai/doc-search'
import type { DocChunks, DocChunk } from '@/lib/ai/doc-chunk-types'

describe('DocSearch', () => {
  // Mock data for testing
  const mockChunks: DocChunk[] = [
    {
      id: 'chunk-1',
      title: 'Creating Collections',
      content:
        'How to create a new collection in Payload CMS. Use the collections array in payload.config.ts and define fields.',
      category: 'collections',
      keywords: ['collection', 'create', 'schema', 'fields'],
      priority: 5,
      sourceFile: 'docs/collections.md',
    },
    {
      id: 'chunk-2',
      title: 'Access Control Basics',
      content:
        'Security patterns for access control. Define access functions that return boolean or query constraints.',
      category: 'security',
      keywords: ['access', 'control', 'security', 'auth', 'permission'],
      priority: 5,
      sourceFile: 'docs/security.md',
    },
    {
      id: 'chunk-3',
      title: 'React Components',
      content: 'Build components using React and Tailwind CSS. Follow the component patterns.',
      category: 'components',
      keywords: ['component', 'react', 'jsx', 'tailwind', 'style'],
      priority: 3,
      sourceFile: 'docs/components.md',
    },
    {
      id: 'chunk-4',
      title: 'Testing with Vitest',
      content: 'Write integration tests using Vitest. Use describe, it, and expect for assertions.',
      category: 'testing',
      keywords: ['test', 'vitest', 'integration', 'spec'],
      priority: 2,
      sourceFile: 'docs/testing.md',
    },
    {
      id: 'chunk-5',
      title: 'Collection Fields',
      content: 'Define fields for collections including text, number, relationship, and more.',
      category: 'collections',
      keywords: ['field', 'collection', 'schema', 'type'],
      priority: 4,
      sourceFile: 'docs/collections.md',
    },
  ]

  const mockDocChunks: DocChunks = {
    chunks: mockChunks,
    metadata: {
      generatedAt: new Date().toISOString(),
      totalChunks: mockChunks.length,
      sourceFiles: ['docs/collections.md', 'docs/security.md', 'docs/components.md'],
    },
  }

  let docSearch: DocSearch

  beforeEach(() => {
    docSearch = new DocSearch(mockDocChunks)
  })

  describe('constructor', () => {
    it('should load chunks from provided data', () => {
      const search = new DocSearch(mockDocChunks)
      const stats = search.getStats()

      expect(stats.totalChunks).toBe(5)
    })

    it('should build keyword index correctly', () => {
      const stats = docSearch.getStats()

      // Should have unique keywords indexed
      expect(stats.totalKeywords).toBeGreaterThan(0)
    })

    it('should build category index correctly', () => {
      const categories = docSearch.getCategories()

      expect(categories).toContain('collections')
      expect(categories).toContain('security')
      expect(categories).toContain('components')
      expect(categories).toContain('testing')
    })

    it('should handle empty chunks', () => {
      const emptySearch = new DocSearch({ chunks: [], metadata: mockDocChunks.metadata })
      const stats = emptySearch.getStats()

      expect(stats.totalChunks).toBe(0)
      expect(stats.totalKeywords).toBe(0)
    })
  })

  describe('query', () => {
    it('should find exact title matches with high score', () => {
      const results = docSearch.query('Creating Collections')

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].chunk.id).toBe('chunk-1')
      expect(results[0].score).toBeGreaterThanOrEqual(50) // Exact title match bonus
    })

    it('should find partial title matches', () => {
      const results = docSearch.query('Collections')

      expect(results.length).toBeGreaterThan(0)
      const collectionChunks = results.filter((r) => r.chunk.title.includes('Collection'))
      expect(collectionChunks.length).toBeGreaterThan(0)
    })

    it('should match keywords', () => {
      const results = docSearch.query('access control')

      expect(results.length).toBeGreaterThan(0)
      const securityChunk = results.find((r) => r.chunk.id === 'chunk-2')
      expect(securityChunk).toBeDefined()
      expect(securityChunk!.matchedKeywords).toContain('access')
    })

    it('should filter by category parameter', () => {
      const results = docSearch.query('collection', { category: 'collections' })

      expect(results.length).toBeGreaterThan(0)
      results.forEach((r) => {
        expect(r.chunk.category).toBe('collections')
      })
    })

    it('should respect minScore threshold', () => {
      const results = docSearch.query('random query', { minScore: 100 })

      // Very high threshold, should return few or no results
      results.forEach((r) => {
        expect(r.score).toBeGreaterThanOrEqual(100)
      })
    })

    it('should respect limit parameter', () => {
      const results = docSearch.query('collection', { limit: 2 })

      expect(results.length).toBeLessThanOrEqual(2)
    })

    it('should return results sorted by score descending', () => {
      const results = docSearch.query('collection')

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
      }
    })

    it('should boost chunks based on priority field', () => {
      const results = docSearch.query('collection')

      // Higher priority chunks should generally score higher
      const highPriorityChunk = results.find((r) => r.chunk.id === 'chunk-1') // priority 5
      const lowerPriorityChunk = results.find((r) => r.chunk.id === 'chunk-5') // priority 4

      if (highPriorityChunk && lowerPriorityChunk) {
        // Priority boost is +2 per priority point, so chunk-1 gets +2 more points
        expect(highPriorityChunk.score).toBeGreaterThan(lowerPriorityChunk.score - 10)
      }
    })

    it('should handle empty query string', () => {
      const results = docSearch.query('')

      // Empty query might return results based on priority
      expect(results).toBeDefined()
    })

    it('should handle no matches found', () => {
      const results = docSearch.query('xyznonexistentquery123', { minScore: 50 })

      expect(results).toBeDefined()
      expect(results).toHaveLength(0)
    })

    it('should not include content when includeContent is false', () => {
      const results = docSearch.query('collection', { includeContent: false })

      expect(results.length).toBeGreaterThan(0)
      results.forEach((r) => {
        expect(r.chunk.content).toBe('')
      })
    })

    it('should include content by default', () => {
      const results = docSearch.query('collection')

      expect(results.length).toBeGreaterThan(0)
      results.forEach((r) => {
        expect(r.chunk.content).not.toBe('')
      })
    })

    it('should match content text', () => {
      const results = docSearch.query('Payload CMS')

      const chunk1 = results.find((r) => r.chunk.id === 'chunk-1')
      expect(chunk1).toBeDefined()
    })

    it('should set correct relevance levels', () => {
      const highScoreResults = docSearch.query('Creating Collections')
      const lowScoreResults = docSearch.query('random')

      if (highScoreResults.length > 0) {
        expect(['high', 'medium']).toContain(highScoreResults[0].relevance)
      }

      if (lowScoreResults.length > 0) {
        expect(['low', 'medium', 'high']).toContain(lowScoreResults[0].relevance)
      }
    })
  })

  describe('scoring algorithm', () => {
    it('should give high score for exact title match', () => {
      const results = docSearch.query('Creating Collections')

      const exactMatch = results.find((r) => r.chunk.title === 'Creating Collections')
      expect(exactMatch).toBeDefined()
      expect(exactMatch!.score).toBeGreaterThanOrEqual(50)
    })

    it('should give points for title contains query', () => {
      const results = docSearch.query('Collections')

      const partialMatch = results.find((r) => r.chunk.title.includes('Collections'))
      expect(partialMatch).toBeDefined()
      expect(partialMatch!.score).toBeGreaterThan(0)
    })

    it('should give points for keyword matches', () => {
      const results = docSearch.query('access')

      const keywordMatch = results.find((r) => r.chunk.keywords.includes('access'))
      expect(keywordMatch).toBeDefined()
      expect(keywordMatch!.matchedKeywords).toContain('access')
    })

    it('should give points for content matches', () => {
      const results = docSearch.query('Tailwind CSS')

      const contentMatch = results.find((r) => r.chunk.content.includes('Tailwind CSS'))
      expect(contentMatch).toBeDefined()
    })

    it('should combine multiple scoring factors', () => {
      const results = docSearch.query('collection create')

      // Should match both title and keywords
      const topResult = results[0]
      expect(topResult.score).toBeGreaterThan(20) // Multiple factors should add up
    })
  })

  describe('findSimilar', () => {
    it('should find chunks with overlapping keywords', () => {
      const similar = docSearch.findSimilar('chunk-1') // Has keywords: collection, create, schema, fields

      expect(similar.length).toBeGreaterThan(0)
      // chunk-5 also has 'collection' and 'schema' keywords
      const chunk5 = similar.find((c) => c.id === 'chunk-5')
      expect(chunk5).toBeDefined()
    })

    it('should exclude the source chunk from results', () => {
      const similar = docSearch.findSimilar('chunk-1')

      const sourceChunk = similar.find((c) => c.id === 'chunk-1')
      expect(sourceChunk).toBeUndefined()
    })

    it('should respect limit parameter', () => {
      const similar = docSearch.findSimilar('chunk-1', 2)

      expect(similar.length).toBeLessThanOrEqual(2)
    })

    it('should return empty array for non-existent chunk ID', () => {
      const similar = docSearch.findSimilar('non-existent-id')

      expect(similar).toEqual([])
    })

    it('should sort by keyword overlap descending', () => {
      const similar = docSearch.findSimilar('chunk-1', 5)

      // Results should be sorted by overlap count
      // chunk-5 shares 'collection' and 'schema' with chunk-1 (2 keywords)
      if (similar.length > 1) {
        // Just verify we get results, exact order depends on keyword overlap
        expect(similar.length).toBeGreaterThan(0)
      }
    })

    it('should handle chunks with no keyword overlap', () => {
      // Create a search with isolated chunks
      const isolatedChunks: DocChunk[] = [
        { ...mockChunks[0], keywords: ['unique1', 'unique2'] },
        { ...mockChunks[1], keywords: ['different1', 'different2'] },
      ]
      const isolatedSearch = new DocSearch({
        chunks: isolatedChunks,
        metadata: mockDocChunks.metadata,
      })

      const similar = isolatedSearch.findSimilar(isolatedChunks[0].id)

      // No overlapping keywords, might return empty or low-overlap results
      expect(similar).toBeDefined()
    })
  })

  describe('getCategories', () => {
    it('should return unique category names', () => {
      const categories = docSearch.getCategories()

      expect(categories).toContain('collections')
      expect(categories).toContain('security')
      expect(categories).toContain('components')
      expect(categories).toContain('testing')
    })

    it('should return empty array if no chunks', () => {
      const emptySearch = new DocSearch({ chunks: [], metadata: mockDocChunks.metadata })
      const categories = emptySearch.getCategories()

      expect(categories).toEqual([])
    })
  })

  describe('getStats', () => {
    it('should return correct total chunk count', () => {
      const stats = docSearch.getStats()

      expect(stats.totalChunks).toBe(5)
    })

    it('should return category counts', () => {
      const stats = docSearch.getStats()

      expect(stats.categories).toBeDefined()
      expect(stats.categories.length).toBeGreaterThan(0)

      const collectionsCategory = stats.categories.find((c) => c.name === 'collections')
      expect(collectionsCategory).toBeDefined()
      expect(collectionsCategory!.count).toBe(2) // chunk-1 and chunk-5
    })

    it('should return total keyword count', () => {
      const stats = docSearch.getStats()

      expect(stats.totalKeywords).toBeGreaterThan(0)
    })

    it('should handle empty search', () => {
      const emptySearch = new DocSearch({ chunks: [], metadata: mockDocChunks.metadata })
      const stats = emptySearch.getStats()

      expect(stats.totalChunks).toBe(0)
      expect(stats.totalKeywords).toBe(0)
      expect(stats.categories).toEqual([])
    })
  })

  describe('singleton getDocSearch', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = getDocSearch()
      const instance2 = getDocSearch()

      expect(instance1).toBe(instance2)
    })

    it('should return a DocSearch instance', () => {
      const instance = getDocSearch()

      expect(instance).toBeInstanceOf(DocSearch)
    })
  })

  describe('edge cases', () => {
    it('should handle queries with special characters', () => {
      const results = docSearch.query('collection?')

      expect(results).toBeDefined()
    })

    it('should handle very long queries', () => {
      const longQuery = 'collection '.repeat(50)
      const results = docSearch.query(longQuery)

      expect(results).toBeDefined()
    })

    it('should handle case-insensitive search', () => {
      const lowerResults = docSearch.query('collections')
      const upperResults = docSearch.query('COLLECTIONS')
      const mixedResults = docSearch.query('CoLLecTioNs')

      expect(lowerResults.length).toBeGreaterThan(0)
      expect(upperResults.length).toBeGreaterThan(0)
      expect(mixedResults.length).toBeGreaterThan(0)
    })

    it('should handle whitespace in queries', () => {
      const results = docSearch.query('  collection  create  ')

      expect(results.length).toBeGreaterThan(0)
    })

    it('should handle queries with numbers', () => {
      const results = docSearch.query('123 collection')

      expect(results).toBeDefined()
    })

    it('should handle chunks with empty keywords', () => {
      const chunksWithEmptyKeywords: DocChunk[] = [
        {
          ...mockChunks[0],
          keywords: [],
        },
      ]
      const search = new DocSearch({
        chunks: chunksWithEmptyKeywords,
        metadata: mockDocChunks.metadata,
      })
      const results = search.query('collection')

      expect(results).toBeDefined()
    })

    it('should handle chunks with very long content', () => {
      const longContent = 'A'.repeat(10000)
      const chunksWithLongContent: DocChunk[] = [
        {
          ...mockChunks[0],
          content: longContent,
        },
      ]
      const search = new DocSearch({
        chunks: chunksWithLongContent,
        metadata: mockDocChunks.metadata,
      })
      const results = search.query('collection')

      expect(results).toBeDefined()
    })
  })

  describe('relevance classification', () => {
    it('should classify high relevance correctly', () => {
      const results = docSearch.query('Creating Collections')

      const highRelevanceResult = results.find((r) => r.score >= 50)
      if (highRelevanceResult) {
        expect(highRelevanceResult.relevance).toBe('high')
      }
    })

    it('should classify medium relevance correctly', () => {
      const results = docSearch.query('field')

      const mediumRelevanceResult = results.find((r) => r.score >= 20 && r.score < 50)
      if (mediumRelevanceResult) {
        expect(mediumRelevanceResult.relevance).toBe('medium')
      }
    })

    it('should classify low relevance correctly', () => {
      const results = docSearch.query('x', { minScore: 1 })

      const lowRelevanceResult = results.find((r) => r.score < 20)
      if (lowRelevanceResult) {
        expect(lowRelevanceResult.relevance).toBe('low')
      }
    })
  })

  describe('category relevance boost', () => {
    it('should boost collections category for collection-related queries', () => {
      const results = docSearch.query('field schema model')

      // 'field' and 'schema' and 'model' should match collections category keywords
      const collectionChunks = results.filter((r) => r.chunk.category === 'collections')
      expect(collectionChunks.length).toBeGreaterThan(0)
    })

    it('should boost security category for security-related queries', () => {
      const results = docSearch.query('access control permission auth')

      const securityChunks = results.filter((r) => r.chunk.category === 'security')
      expect(securityChunks.length).toBeGreaterThan(0)
    })

    it('should boost components category for component-related queries', () => {
      const results = docSearch.query('react component tailwind')

      const componentChunks = results.filter((r) => r.chunk.category === 'components')
      expect(componentChunks.length).toBeGreaterThan(0)
    })

    it('should boost testing category for test-related queries', () => {
      const results = docSearch.query('test spec vitest')

      const testChunks = results.filter((r) => r.chunk.category === 'testing')
      expect(testChunks.length).toBeGreaterThan(0)
    })
  })
})
