import type { Migration } from 'payload'

export const backfillExerciseOrigin: Migration = {
  async up(db) {
    // Backfill origin='manual' for existing exercises that don't have origin set
    const result = await db.collection('exercises').updateMany(
      {
        $or: [{ origin: { $exists: false } }, { origin: null }, { origin: '' }],
      },
      {
        $set: { origin: 'manual' },
      },
    )

    console.log(`Backfilled origin field for ${result.modifiedCount} exercises`)
  },

  async down(db) {
    // No-op: We don't want to remove origin values on rollback
    console.log('Rollback: origin field backfill skipped (preserving data)')
  },
}
