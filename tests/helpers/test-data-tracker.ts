/**
 * TestDataTracker - Tracks test-created records for automatic cleanup
 *
 * Usage:
 * ```typescript
 * const tracker = new TestDataTracker(payload)
 *
 * // Track records as you create them
 * const user = await payload.create({ collection: 'users', data: {...} })
 * tracker.track('users', user.id)
 *
 * // Or use the create helper (tracks automatically)
 * const tenant = await tracker.create('tenants', { name: 'Test' })
 *
 * // In afterAll/afterEach - cleans up in reverse dependency order
 * await tracker.cleanup()
 * ```
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Payload } from 'payload'

type CollectionSlug = string

/**
 * Dependency order for cleanup (children first, parents last).
 * Collections listed earlier are deleted first.
 */
const CLEANUP_ORDER: CollectionSlug[] = [
  'extraction-logs',
  'memory_items',
  'chat-assets',
  'upload-sessions',
  'user-progress',
  'conversations',
  'guest-sessions',
  'user_settings',
  'exercises',
  'lessons',
  'chapters',
  'courses',
  'categories',
  'media',
  'prompts',
  'pages',
  'posts',
  'users',
  'tenants',
]

export class TestDataTracker {
  private records: Map<CollectionSlug, Set<string>> = new Map()
  private payload: Payload

  constructor(payload: Payload) {
    this.payload = payload
  }

  /**
   * Register a record for cleanup
   */
  track(collection: CollectionSlug, id: string): void {
    if (!this.records.has(collection)) {
      this.records.set(collection, new Set())
    }
    this.records.get(collection)!.add(id)
  }

  /**
   * Create a record and automatically track it
   */
  async create(
    collection: CollectionSlug,
    data: Record<string, unknown>,
    options: { overrideAccess?: boolean; draft?: boolean } = {},
  ): Promise<{ id: string; [key: string]: unknown }> {
    const result = await (this.payload as any).create({
      collection,
      data,
      overrideAccess: options.overrideAccess ?? true,
      draft: options.draft,
    })

    this.track(collection, (result as any).id)
    return result as { id: string; [key: string]: unknown }
  }

  /**
   * Remove a record from tracking (e.g., if test already deleted it)
   */
  untrack(collection: CollectionSlug, id: string): void {
    this.records.get(collection)?.delete(id)
  }

  /**
   * Get all tracked IDs for a collection
   */
  getTracked(collection: CollectionSlug): string[] {
    return Array.from(this.records.get(collection) ?? [])
  }

  /**
   * Clean up all tracked records in dependency-safe order.
   * Runs even if individual deletes fail (failure-safe).
   */
  async cleanup(): Promise<{ deleted: number; errors: string[] }> {
    let deleted = 0
    const errors: string[] = []

    const sortedCollections = this.getSortedCollections()

    for (const collection of sortedCollections) {
      const ids = this.records.get(collection)
      if (!ids || ids.size === 0) continue

      for (const id of ids) {
        try {
          await (this.payload as any).delete({
            collection,
            id,
            overrideAccess: true,
          })
          deleted++
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          if (!msg.includes('not found') && !msg.includes('Not Found')) {
            errors.push(`Failed to delete ${collection}/${id}: ${msg}`)
          }
        }
      }
    }

    this.records.clear()
    return { deleted, errors }
  }

  /**
   * Sort tracked collections by dependency order.
   * Collections in CLEANUP_ORDER are sorted by their position.
   * Unknown collections are cleaned up first (safest default).
   */
  private getSortedCollections(): CollectionSlug[] {
    const tracked = Array.from(this.records.keys())

    return tracked.sort((a, b) => {
      const indexA = CLEANUP_ORDER.indexOf(a)
      const indexB = CLEANUP_ORDER.indexOf(b)

      if (indexA === -1 && indexB === -1) return 0
      if (indexA === -1) return -1
      if (indexB === -1) return 1
      return indexA - indexB
    })
  }

  /**
   * Check if any records are still tracked (for verification)
   */
  get isEmpty(): boolean {
    for (const ids of this.records.values()) {
      if (ids.size > 0) return false
    }
    return true
  }

  /**
   * Get total count of tracked records
   */
  get count(): number {
    let total = 0
    for (const ids of this.records.values()) {
      total += ids.size
    }
    return total
  }
}
