/**
 * Migration: Add idempotency key unique index
 *
 * Creates a unique index on idempotencyKey for source-based deduplication.
 * Uses sparse: true to allow null values for legacy exercises.
 *
 * Run with: pnpm migration:run 004
 */
import type { Migration } from 'payload'

export const addIdempotencyKeyIndex: Migration = {
  name: 'add-idempotency-key-index',
  async up(db) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mongoDb = db as any
    await mongoDb.collection('exercises').createIndex(
      { idempotencyKey: 1 },
      {
        unique: true,
        sparse: true, // Allow null for legacy docs
        name: 'idx_exercise_idempotency_key_unique',
      },
    )
  },

  async down(db) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mongoDb = db as any
    await mongoDb.collection('exercises').dropIndex('idx_exercise_idempotency_key_unique')
  },
}
