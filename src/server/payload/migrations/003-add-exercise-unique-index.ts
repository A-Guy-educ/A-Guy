import type { Migration } from 'payload'

export const addExerciseUniqueIndex: Migration = {
  name: 'add-exercise-unique-index',
  async up(db: any) {
    // Create unique compound index on (lesson, sourceDoc, contentHash)
    // This prevents duplicate exercises from being created
    try {
      await db
        .collection('exercises')
        .createIndex(
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
  },

  async down(db: any) {
    await db.collection('exercises').dropIndex('idx_exercise_unique_identity')
    console.log('[Migration 003] Dropped unique index (lesson, sourceDoc, contentHash)')
  },
}
