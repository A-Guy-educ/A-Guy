/**
 * Smart Documentation Loader
 *
 * Provides context-aware documentation loading for AI agents.
 * Analyzes the task and loads only relevant documentation chunks.
 *
 * @fileType utility
 * @domain ai
 * @pattern context-aware-loading
 * @ai-summary Context-aware documentation loader that minimizes token usage
 */

import { DocSearch, type SearchResult } from './doc-search'
import type { DocChunk } from './doc-chunk-types'

/**
 * AI Agent Context
 */
export interface AIContext {
  /** Type of task being performed */
  task: 'create' | 'update' | 'debug' | 'explain' | 'refactor'

  /** Domain being worked on */
  domain: 'collection' | 'component' | 'endpoint' | 'test' | 'utility' | 'general'

  /** Files being worked on */
  files?: string[]

  /** Patterns being used */
  patterns?: string[]

  /** Keywords from the user's request */
  keywords?: string[]
}

/**
 * Documentation tier (hierarchical loading)
 */
export type DocTier = 'quick-reference' | 'patterns' | 'deep-reference'

/**
 * Loaded documentation with metadata
 */
export interface LoadedDocs {
  /** Documentation chunks */
  chunks: DocChunk[]

  /** Tier used */
  tier: DocTier

  /** Estimated token count */
  estimatedTokens: number

  /** Categories included */
  categories: string[]

  /** Recommendation for next action */
  recommendation?: string
}

/**
 * Usage statistics for tracking
 */
export interface UsageStats {
  /** Total queries made */
  totalQueries: number

  /** Average tokens per query */
  avgTokens: number

  /** Most used categories */
  topCategories: Record<string, number>

  /** Most common tasks */
  taskDistribution: Record<AIContext['task'], number>
}

/**
 * Smart Documentation Loader
 *
 * Intelligently loads documentation based on AI agent context
 */
export class SmartDocLoader {
  private docSearch: DocSearch
  private usageHistory: Array<{
    context: AIContext
    tier: DocTier
    tokens: number
    timestamp: Date
  }>

  constructor() {
    this.docSearch = new DocSearch()
    this.usageHistory = []
  }

  /**
   * Load relevant documentation based on context
   */
  loadDocs(context: AIContext): LoadedDocs {
    // Determine which tier to use
    const tier = this.determineTier(context)

    // Build search query from context
    const query = this.buildQuery(context)

    // Get relevant chunks
    const results = this.getRelevantChunks(query, tier, context)

    // Calculate estimated tokens
    const chunks = results.map((r) => r.chunk)
    const estimatedTokens = this.estimateTokens(chunks)

    // Track usage
    this.trackUsage(context, tier, estimatedTokens)

    // Get unique categories
    const categories = [...new Set(chunks.map((c) => c.category))]

    // Generate recommendation
    const recommendation = this.generateRecommendation(chunks, tier, estimatedTokens)

    return {
      chunks,
      tier,
      estimatedTokens,
      categories,
      recommendation,
    }
  }

  /**
   * Determine which documentation tier to use
   */
  private determineTier(context: AIContext): DocTier {
    // Quick reference for simple, common tasks
    if (context.task === 'create' && !context.patterns) {
      return 'quick-reference'
    }

    // Quick reference for basic explanations
    if (context.task === 'explain' && !context.files) {
      return 'quick-reference'
    }

    // Patterns tier for updates and refactoring
    if (context.task === 'update' || context.task === 'refactor') {
      return 'patterns'
    }

    // Patterns tier when specific patterns are mentioned
    if (context.patterns && context.patterns.length > 0) {
      return 'patterns'
    }

    // Deep reference for debugging
    if (context.task === 'debug') {
      return 'deep-reference'
    }

    // Default to quick reference
    return 'quick-reference'
  }

  /**
   * Build search query from context
   */
  private buildQuery(context: AIContext): string {
    const parts: string[] = []

    // Add domain
    parts.push(context.domain)

    // Add task type
    if (context.task === 'create') {
      parts.push('create', 'new', 'pattern', 'template')
    } else if (context.task === 'debug') {
      parts.push('troubleshooting', 'error', 'fix')
    } else if (context.task === 'explain') {
      parts.push('how to', 'guide')
    }

    // Add patterns
    if (context.patterns) {
      parts.push(...context.patterns)
    }

    // Add keywords
    if (context.keywords) {
      parts.push(...context.keywords)
    }

    return parts.join(' ')
  }

  /**
   * Get relevant chunks based on tier and context
   */
  private getRelevantChunks(query: string, tier: DocTier, _context: AIContext): SearchResult[] {
    // Determine category filter
    let category: string | undefined

    if (tier === 'quick-reference') {
      category = 'quick-reference'
    }

    // Determine how many results to return
    const limit = tier === 'quick-reference' ? 3 : tier === 'patterns' ? 5 : 10

    // Search with filters
    const results = this.docSearch.query(query, {
      limit,
      category,
      minScore: tier === 'quick-reference' ? 40 : 20,
    })

    // If we got no results from quick-reference, escalate
    if (results.length === 0 && tier === 'quick-reference') {
      return this.docSearch.query(query, { limit: 5 })
    }

    return results
  }

  /**
   * Estimate token count for chunks
   */
  private estimateTokens(chunks: DocChunk[]): number {
    // Rough estimate: 4 characters per token
    const totalChars = chunks.reduce((sum, chunk) => {
      return sum + chunk.title.length + chunk.content.length
    }, 0)

    return Math.ceil(totalChars / 4)
  }

  /**
   * Track usage for analytics
   */
  private trackUsage(context: AIContext, tier: DocTier, tokens: number): void {
    this.usageHistory.push({
      context,
      tier,
      tokens,
      timestamp: new Date(),
    })

    // Keep only last 100 entries
    if (this.usageHistory.length > 100) {
      this.usageHistory.shift()
    }
  }

  /**
   * Generate recommendation for next action
   */
  private generateRecommendation(
    chunks: DocChunk[],
    tier: DocTier,
    tokens: number,
  ): string | undefined {
    if (chunks.length === 0) {
      return 'No documentation found. Try broader search terms or check AGENTS.md manually.'
    }

    if (tier === 'quick-reference' && tokens < 200) {
      return 'Loaded quick reference successfully. This should be sufficient for common tasks.'
    }

    if (tier === 'quick-reference' && tokens > 500) {
      return 'Quick reference returned a lot of content. Consider more specific keywords.'
    }

    if (tier === 'patterns' && chunks.length < 3) {
      return 'Limited pattern documentation found. May need to escalate to deep-reference or AGENTS.md.'
    }

    return undefined
  }

  /**
   * Get usage statistics
   */
  getStats(): UsageStats {
    if (this.usageHistory.length === 0) {
      return {
        totalQueries: 0,
        avgTokens: 0,
        topCategories: {},
        taskDistribution: {
          create: 0,
          update: 0,
          debug: 0,
          explain: 0,
          refactor: 0,
        },
      }
    }

    const totalQueries = this.usageHistory.length
    const avgTokens = Math.round(
      this.usageHistory.reduce((sum, entry) => sum + entry.tokens, 0) / totalQueries,
    )

    // Count tasks
    const taskDistribution = this.usageHistory.reduce(
      (acc, entry) => {
        acc[entry.context.task] = (acc[entry.context.task] || 0) + 1
        return acc
      },
      {} as Record<AIContext['task'], number>,
    )

    // Track categories (would need to extract from chunks)
    const topCategories: Record<string, number> = {}

    return {
      totalQueries,
      avgTokens,
      topCategories,
      taskDistribution,
    }
  }

  /**
   * Format loaded docs as markdown for AI consumption
   */
  formatForAI(loadedDocs: LoadedDocs): string {
    const lines: string[] = []

    lines.push(`# Documentation (${loadedDocs.tier})`)
    lines.push('')
    lines.push(`**Token Budget**: ~${loadedDocs.estimatedTokens} tokens`)
    lines.push(`**Categories**: ${loadedDocs.categories.join(', ')}`)
    lines.push('')

    if (loadedDocs.recommendation) {
      lines.push(`> **Recommendation**: ${loadedDocs.recommendation}`)
      lines.push('')
    }

    lines.push('---')
    lines.push('')

    loadedDocs.chunks.forEach((chunk, index) => {
      lines.push(`## ${index + 1}. ${chunk.title}`)
      lines.push('')
      lines.push(`*Source: ${chunk.sourceFile} | Category: ${chunk.category}*`)
      lines.push('')
      lines.push(chunk.content)
      lines.push('')
      lines.push('---')
      lines.push('')
    })

    return lines.join('\n')
  }

  /**
   * Quick helper: Load docs for creating a collection
   */
  static forCollection(task: 'create' | 'update' = 'create'): LoadedDocs {
    const loader = new SmartDocLoader()
    return loader.loadDocs({
      task,
      domain: 'collection',
      keywords: ['access control', 'fields', 'security'],
    })
  }

  /**
   * Quick helper: Load docs for creating a component
   */
  static forComponent(task: 'create' | 'update' = 'create'): LoadedDocs {
    const loader = new SmartDocLoader()
    return loader.loadDocs({
      task,
      domain: 'component',
      keywords: ['tailwind', 'styling', 'props'],
    })
  }

  /**
   * Quick helper: Load docs for creating an endpoint
   */
  static forEndpoint(task: 'create' | 'update' = 'create'): LoadedDocs {
    const loader = new SmartDocLoader()
    return loader.loadDocs({
      task,
      domain: 'endpoint',
      keywords: ['authentication', 'validation', 'zod'],
    })
  }

  /**
   * Quick helper: Load docs for debugging
   */
  static forDebugging(domain: AIContext['domain']): LoadedDocs {
    const loader = new SmartDocLoader()
    return loader.loadDocs({
      task: 'debug',
      domain,
      keywords: ['troubleshooting', 'common issues', 'anti-patterns'],
    })
  }
}

/**
 * Singleton instance for easy access
 */
let loaderInstance: SmartDocLoader | null = null

export function getSmartDocLoader(): SmartDocLoader {
  if (!loaderInstance) {
    loaderInstance = new SmartDocLoader()
  }
  return loaderInstance
}

export type { DocChunk }
