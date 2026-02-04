/**
 * Migration: Drop content hash unique index (cleanup)
 *
 * Removes the old unique index on contentHash after stability is confirmed.
 * Keeps a non-unique index on contentHash for debugging queries.
 *
 * Run with: pnpm migration:run 005
 */
import type { Migration } from 'payload'

export const dropContentHashUniqueIndex: Migration = {
  name: 'drop-content-hash-unique-index',
  async up(db) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mongoDb = db as any

    // Drop old unique index (assumed name from migration 003 or default)
    try {
      await mongoDb.collection('exercises').dropIndex('idx_exercise_content_hash_unique')
    } catch (error) {
      // Index might not exist or have different name, continue
      console.warn('[Migration 005] Could not drop content hash unique index:', error)
    }

    // Keep non-unique index on contentHash for debugging queries
    await mongoDb
      .collection('exercises')
      .createIndex({ contentHash: 1 }, { unique: false, name: 'idx_exercise_content_hash' })
  },

  async down(db) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mongoDb = db as any
    await mongoDb.collection('exercises').dropIndex('idx_exercise_content_hash')

    // Recreate the unique index (approximate)
    await mongoDb
      .collection('exercises')
      .createIndex(
        { contentHash: 1 },
        { unique: true, sparse: true, name: 'idx_exercise_content_hash_unique' },
      )
  },
}
