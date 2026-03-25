/**
 * Bulk Migration Script: Exercise Content v1 → v2
 *
 * Usage:
 *   pnpm tsx scripts/migrate-exercises-v2.ts [--dry-run | --execute]
 *
 * Default: --dry-run (no writes)
 * --execute: Actually write migrated content to database
 */

import { getPayload } from 'payload'
import { logger } from '../src/infra/utils/logger'
import config from '../src/payload.config'
import {
  hasV1Content,
  migrateExerciseToV2,
} from '../src/server/payload/collections/Exercises/migration'
import type { ContentData } from '../src/server/payload/collections/Exercises/types'

const BATCH_SIZE = 50

interface MigrationResult {
  total: number
  migrated: number
  skipped: number
  failed: number
  errors: Array<{ id: string; error: string }>
}

async function migrateExercises(execute: boolean = false): Promise<MigrationResult> {
  const payload = await getPayload({ config })

  logger.info({ execute }, 'Starting exercise migration to v2')

  // Get total count of exercises
  const { totalDocs } = await payload.find({
    collection: 'exercises',
    limit: 0,
    depth: 0,
  })

  logger.info({ totalDocs }, 'Total exercises found')

  const result: MigrationResult = {
    total: totalDocs,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }

  if (totalDocs === 0) {
    return result
  }

  let processed = 0

  while (processed < totalDocs) {
    // Fetch a batch of exercises
    const batch = await payload.find({
      collection: 'exercises',
      limit: BATCH_SIZE,
      depth: 0,
      page: Math.floor(processed / BATCH_SIZE) + 1,
    })

    for (const exercise of batch.docs) {
      try {
        // Get the content field
        const rawContent = exercise.content as unknown

        // Skip if content is empty or not an object
        if (!rawContent || typeof rawContent !== 'object' || !('blocks' in rawContent)) {
          result.skipped++
          continue
        }

        const content = rawContent as ContentData

        // Check if already migrated (no v1 content)
        if (!hasV1Content(content)) {
          result.skipped++
          continue
        }

        // Migrate the content
        const migratedContent = migrateExerciseToV2(content)

        if (execute) {
          // Actually write to the database
          // Cast to the JSON type expected by Payload
          await payload.update({
            collection: 'exercises',
            id: exercise.id,
            data: {
              content: migratedContent as unknown as Record<string, unknown>,
            },
          })
          result.migrated++
          logger.info({ id: exercise.id }, 'Migrated exercise')
        } else {
          result.migrated++
          // In dry-run, just log what would happen
          logger.info({ id: exercise.id }, '[DRY-RUN] Would migrate exercise')
        }
      } catch (error) {
        result.failed++
        const errorMessage = error instanceof Error ? error.message : String(error)
        result.errors.push({
          id: exercise.id,
          error: errorMessage,
        })
        logger.error({ id: exercise.id, error: errorMessage }, 'Failed to migrate exercise')
      }
    }

    processed += batch.docs.length
    logger.info({ processed, total: totalDocs }, 'Progress')
  }

  return result
}

async function main() {
  const args = process.argv.slice(2)
  const execute = args.includes('--execute')

  if (!execute && !args.includes('--dry-run')) {
    logger.info('No mode specified, defaulting to --dry-run')
  }

  const mode = execute ? 'EXECUTE' : 'DRY-RUN'
  logger.info({ mode }, 'Running in mode')

  if (execute) {
    logger.warn('⚠️  RUNNING IN EXECUTE MODE - THIS WILL MODIFY THE DATABASE!')
  }

  const startTime = Date.now()
  const result = await migrateExercises(execute)
  const duration = Date.now() - startTime

  // Output final report
  logger.info({ ...result, duration: `${duration}ms` }, 'Migration complete')

  // Also output JSON for easy parsing
  console.log('\n--- Migration Report ---')
  console.log(`Total: ${result.total}`)
  console.log(`Migrated: ${result.migrated}`)
  console.log(`Skipped (already v2 or empty): ${result.skipped}`)
  console.log(`Failed: ${result.failed}`)
  console.log(`Duration: ${duration}ms`)

  if (result.errors.length > 0) {
    console.log('\nErrors:')
    for (const { id, error } of result.errors) {
      console.log(`  - ${id}: ${error}`)
    }
  }

  if (!execute) {
    console.log('\n⚠️  Run with --execute to actually write to the database')
  }

  // Exit with error code if any failures
  if (result.failed > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  logger.error({ error }, 'Migration failed with unhandled error')
  console.error(error)
  process.exit(1)
})
