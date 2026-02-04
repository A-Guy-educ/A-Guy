/**
 * Migration Script: Backfill v2 Fields for Existing Conversion Jobs
 *
 * This script adds new v2 fields to existing conversion jobs:
 * - promptSnapshot hash fields
 * - additionalRounds initialization
 * - progress tracking fields
 * - segment status updates
 *
 * Usage: pnpm tsx scripts/migrate-conversion-jobs.ts [--dry-run]
 */

import { getPayload } from 'payload'
import config from '../src/payload.config'

interface MigrationStats {
  processed: number
  updated: number
  errors: number
  skipped: number
}

async function migrate() {
  const dryRun = process.argv.includes('--dry-run')
  const stats: MigrationStats = { processed: 0, updated: 0, errors: 0, skipped: 0 }

  console.log(`[Migration] Starting v2 migration${dryRun ? ' (DRY RUN)' : ''}`)

  const payload = await getPayload({ config })

  // Find all existing conversion jobs (non-draft)
  const result = await payload.find({
    collection: 'conversion-jobs',
    where: {
      status: { not_equals: 'draft' },
    },
    limit: 1000,
    depth: 0,
  })

  console.log(`[Migration] Found ${result.totalDocs} conversion jobs to migrate`)

  for (const job of result.docs) {
    stats.processed++
    const updates: Record<string, unknown> = {}
    let needsUpdate = false

    try {
      // 1. Add default additionalRounds if missing
      if (!job.additionalRounds || (job.additionalRounds as unknown[]).length === 0) {
        updates.additionalRounds = []
        needsUpdate = true
      }

      // 2. Initialize progress fields if missing
      const progress = job.progress as Record<string, unknown> | null | undefined
      if (!progress || !progress.totalExercises) {
        updates.progress = {
          ...(progress || {}),
          totalExercises: progress?.completedSegments || 0,
          approvedExercises: 0,
          rejectedExercises: 0,
          skippedExercises: 0,
          dedupedExercises: 0,
        }
        needsUpdate = true
      }

      // 3. Initialize segments with status if missing
      const segments = job.segments as Array<Record<string, unknown>> | null | undefined
      if (segments && segments.length > 0) {
        const updatedSegments = segments.map((seg, idx) => {
          if (!seg.status) {
            needsUpdate = true
            // Infer status from segment data
            let status:
              | 'pending'
              | 'processing'
              | 'extracted'
              | 'review'
              | 'verified'
              | 'completed'
              | 'failed'
              | 'skipped' = 'pending'

            if ((seg.exercisesCreated as number) > 0 || (seg.exercisesDeduped as number) > 0) {
              status = 'extracted'
            }
            if (seg.errorMessage) {
              status = 'failed'
            }
            if (seg.processedAt) {
              status = status === 'pending' ? 'processing' : status
            }

            return {
              ...seg,
              index: (seg.index as number) ?? idx,
              status,
              pageStart: seg.pageStart,
              pageEnd: seg.pageEnd,
            }
          }
          return seg
        })

        if (needsUpdate) {
          updates.segments = updatedSegments
        }
      }

      // 4. Add logs array if missing
      if (!job.logs) {
        updates.logs = []
        needsUpdate = true
      }

      // 5. Add errors array if missing
      if (!job.errors) {
        updates.errors = []
        needsUpdate = true
      }

      // 6. Initialize pendingExercises and completedExercises
      if (!job.pendingExercises) {
        updates.pendingExercises = []
        needsUpdate = true
      }
      if (!job.completedExercises) {
        updates.completedExercises = []
        needsUpdate = true
      }

      // 7. Add timestamps if missing
      if (!job.startedAt) {
        updates.startedAt = new Date().toISOString()
        needsUpdate = true
      }

      if (needsUpdate && !dryRun) {
        await payload.update({
          collection: 'conversion-jobs',
          id: job.id,
          data: updates,
        })
        stats.updated++
        console.log(`[Migration] Updated job ${job.id}: ${Object.keys(updates).join(', ')}`)
      } else if (needsUpdate && dryRun) {
        console.log(`[Migration] Would update job ${job.id}: ${Object.keys(updates).join(', ')}`)
        stats.skipped++
      } else {
        stats.skipped++
      }
    } catch (error) {
      stats.errors++
      console.error(`[Migration] Error processing job ${job.id}:`, error)
    }
  }

  // Summary
  console.log('\n[Migration] Summary:')
  console.log(`  Processed: ${stats.processed}`)
  console.log(`  Updated: ${stats.updated}`)
  console.log(`  Skipped: ${stats.skipped}`)
  console.log(`  Errors: ${stats.errors}`)

  if (dryRun) {
    console.log('\n[Migration] DRY RUN - no changes made')
  } else {
    console.log('\n[Migration] Complete!')
  }

  return stats
}

// Run migration
migrate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Migration] Fatal error:', error)
    process.exit(1)
  })
