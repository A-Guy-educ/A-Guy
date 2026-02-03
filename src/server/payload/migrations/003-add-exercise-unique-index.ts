import type { Migration } from 'payload'

export const addExerciseUniqueIndex: Migration = async ({ req }) => {
  const db = req.payload.db as any
  const coll = db.connection?.collection?.('exercises')

  if (!coll) {
    throw new Error(
      '[Migration 003] Cannot add unique index - exercises collection not accessible. This migration is required for exercise deduplication.',
    )
  }

  // Create unique compound index on (lesson, sourceDoc, contentHash)
  // This prevents duplicate exercises from being created
  try {
    await coll.createIndex(
      { lesson: 1, sourceDoc: 1, contentHash: 1 },
      { unique: true, name: 'idx_exercise_unique_identity' },
    )
    console.log('[Migration 003] Created unique index on (lesson, sourceDoc, contentHash)')
  } catch (indexError: any) {
    if (indexError.code === 85 || indexError.message?.includes('already exists')) {
      console.log('[Migration 003] Unique index already exists, skipping')
    } else {
      throw indexError
    }
  }
}
