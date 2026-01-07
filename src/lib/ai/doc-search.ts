/**
 * Simple Documentation Search
 *
 * Provides fast keyword-based search across documentation chunks.
 * No external dependencies - just JSON + smart scoring.
 *
 * Usage:
 *   const search = new DocSearch()
 *   const results = search.query("How do I create a published collection?")
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { DocChunk, DocChunks } from '../../../scripts/generate-doc-chunks'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface SearchResult {
  chunk: DocChunk
  score: number
  matchedKeywords: string[]
  relevance: 'high' | 'medium' | 'low'
}

interface SearchOptions {
  limit?: number
  category?: string
  minScore?: number
  includeContent?: boolean
}

export class DocSearch {
  private chunks: DocChunk[]
  private keywordIndex: Map<string, Set<string>> // keyword -> chunk IDs
  private categoryIndex: Map<string, Set<string>> // category -> chunk IDs

  constructor(chunksData?: DocChunks) {
    if (chunksData) {
      this.chunks = chunksData.chunks
    } else {
      // Load from file
      try {
        const docChunksPath = path.join(__dirname, '../../../docs/ai/indexes/doc-chunks.json')
        const fileContent = fs.readFileSync(docChunksPath, 'utf-8')
        const data = JSON.parse(fileContent) as DocChunks
        this.chunks = data.chunks
      } catch (error) {
        console.error('Failed to load doc-chunks.json. Run: pnpm tsx scripts/generate-doc-chunks.ts')
        this.chunks = []
      }
    }

    // Build indexes
    this.keywordIndex = new Map()
    this.categoryIndex = new Map()
    this.buildIndexes()
  }

  /**
   * Build search indexes for fast lookup
   */
  private buildIndexes(): void {
    this.chunks.forEach(chunk => {
      // Index by keywords
      chunk.keywords.forEach(keyword => {
        if (!this.keywordIndex.has(keyword)) {
          this.keywordIndex.set(keyword, new Set())
        }
        this.keywordIndex.get(keyword)!.add(chunk.id)
      })

      // Index by category
      if (!this.categoryIndex.has(chunk.category)) {
        this.categoryIndex.set(chunk.category, new Set())
      }
      this.categoryIndex.get(chunk.category)!.add(chunk.id)
    })
  }

  /**
   * Search documentation
   */
  query(query: string, options: SearchOptions = {}): SearchResult[] {
    const {
      limit = 5,
      category,
      minScore = 0,
      includeContent = true
    } = options

    // Normalize query
    const queryLower = query.toLowerCase()
    const queryWords = this.extractWords(queryLower)

    // Score all chunks
    const scored: SearchResult[] = this.chunks
      .map(chunk => {
        // Skip if category filter doesn't match
        if (category && chunk.category !== category) {
          return null
        }

        const { score, matchedKeywords } = this.scoreChunk(chunk, queryLower, queryWords)

        if (score < minScore) {
          return null
        }

        return {
          chunk: includeContent ? chunk : { ...chunk, content: '' },
          score,
          matchedKeywords,
          relevance: this.determineRelevance(score)
        }
      })
      .filter((result): result is SearchResult => result !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    return scored
  }

  /**
   * Score a chunk against the query
   */
  private scoreChunk(
    chunk: DocChunk,
    queryLower: string,
    queryWords: string[]
  ): { score: number; matchedKeywords: string[] } {
    let score = 0
    const matchedKeywords: string[] = []

    // 1. Exact title match: 50 points
    if (chunk.title.toLowerCase() === queryLower) {
      score += 50
    }

    // 2. Title contains query: 30 points
    if (chunk.title.toLowerCase().includes(queryLower)) {
      score += 30
    }

    // 3. Title word matches: 15 points each
    queryWords.forEach(word => {
      if (chunk.title.toLowerCase().includes(word)) {
        score += 15
      }
    })

    // 4. Keyword matches: 10 points each
    queryWords.forEach(word => {
      chunk.keywords.forEach(keyword => {
        if (keyword.includes(word) || word.includes(keyword)) {
          score += 10
          if (!matchedKeywords.includes(keyword)) {
            matchedKeywords.push(keyword)
          }
        }
      })
    })

    // 5. Content contains full query: 20 points
    if (chunk.content.toLowerCase().includes(queryLower)) {
      score += 20
    }

    // 6. Content word matches: 5 points each (capped at 30)
    let contentMatches = 0
    queryWords.forEach(word => {
      if (chunk.content.toLowerCase().includes(word)) {
        contentMatches++
      }
    })
    score += Math.min(contentMatches * 5, 30)

    // 7. Priority boost (from chunk importance)
    score += chunk.priority * 2

    // 8. Category boost for relevant categories
    if (this.isRelevantCategory(chunk.category, queryWords)) {
      score += 15
    }

    return { score, matchedKeywords }
  }

  /**
   * Extract words from text
   */
  private extractWords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
  }

  /**
   * Check if category is relevant to query
   */
  private isRelevantCategory(category: string, queryWords: string[]): boolean {
    const relevanceMap: Record<string, string[]> = {
      collections: ['collection', 'slug', 'field', 'schema', 'model'],
      components: ['component', 'react', 'jsx', 'tsx', 'tailwind', 'style'],
      endpoints: ['endpoint', 'api', 'route', 'handler', 'request'],
      security: ['access', 'control', 'auth', 'permission', 'role', 'security'],
      testing: ['test', 'spec', 'vitest', 'playwright', 'assert'],
      hooks: ['hook', 'before', 'after', 'lifecycle'],
      styling: ['style', 'css', 'tailwind', 'class', 'design']
    }

    const categoryKeywords = relevanceMap[category] || []
    return queryWords.some(word =>
      categoryKeywords.some(keyword => word.includes(keyword) || keyword.includes(word))
    )
  }

  /**
   * Determine relevance level
   */
  private determineRelevance(score: number): 'high' | 'medium' | 'low' {
    if (score >= 50) return 'high'
    if (score >= 20) return 'medium'
    return 'low'
  }

  /**
   * Get all categories
   */
  getCategories(): string[] {
    return Array.from(this.categoryIndex.keys())
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalChunks: this.chunks.length,
      categories: this.getCategories().map(category => ({
        name: category,
        count: this.categoryIndex.get(category)?.size || 0
      })),
      totalKeywords: this.keywordIndex.size
    }
  }

  /**
   * Find similar chunks to a given chunk
   */
  findSimilar(chunkId: string, limit: number = 3): DocChunk[] {
    const chunk = this.chunks.find(c => c.id === chunkId)
    if (!chunk) return []

    // Find chunks with overlapping keywords
    const keywordOverlap = new Map<string, number>()

    chunk.keywords.forEach(keyword => {
      const matchingChunkIds = this.keywordIndex.get(keyword) || new Set()
      matchingChunkIds.forEach(id => {
        if (id !== chunkId) {
          keywordOverlap.set(id, (keywordOverlap.get(id) || 0) + 1)
        }
      })
    })

    // Sort by overlap and return
    return Array.from(keywordOverlap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => this.chunks.find(c => c.id === id))
      .filter((c): c is DocChunk => c !== undefined)
  }
}

/**
 * Singleton instance for easy access
 */
let searchInstance: DocSearch | null = null

export function getDocSearch(): DocSearch {
  if (!searchInstance) {
    searchInstance = new DocSearch()
  }
  return searchInstance
}

export type { SearchResult, SearchOptions }
