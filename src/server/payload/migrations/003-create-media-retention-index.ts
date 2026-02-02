/**
 * Migration: Create media retention cleanup index
 *
 * Creates an index on retentionPolicy and expiresAt fields to optimize
 * the media cleanup cron endpoint query.
 *
 * Run with: pnpm migration:run 003
 */
import type { Migration } from 'payload'

export const createMediaRetentionIndex: Migration = {
  name: 'create-media-retention-index',
  async up(db) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mongoDb = db as any
    await mongoDb
      .collection('media')
      .createIndex({ retentionPolicy: 1, expiresAt: 1 }, { name: 'idx_media_retention_cleanup' })
  },

  async down(db) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mongoDb = db as any
    await mongoDb.collection('media').dropIndex('idx_media_retention_cleanup')
  },
}
