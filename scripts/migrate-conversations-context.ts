/**
 * Migration Script: Context-Scoped Conversations
 *
 * This script migrates existing conversations from the old schema to the new context-scoped schema.
 *
 * Changes:
 * 1. Add contextRef field (polymorphic relationship)
 * 2. Add contextKey field (derived operational key)
 * 3. Add archivedAt field (single source of truth for archival)
 * 4. Keep exercise field for backwards compatibility (marked deprecated)
 * 5. Active conversations must NOT have archivedAt field (missing = active)
 *    NOTE: After migration, run normalize-conversations-archivedAt.ts to clean up any legacy null values
 *    INVARIANT: Active = archivedAt field is MISSING. Archived = archivedAt field EXISTS.
 *
 * Run with: pnpm exec tsx scripts/migrate-conversations-context.ts
 *
 * IMPORTANT: Run with --dry-run first to preview changes
 */

import { logger } from '@/utilities/logger'
import config from '@payload-config'
import { getPayload } from 'payload'

interface MigrationResult {
  success: boolean
  processed: number
  errors: number
  details: string[]
}

interface ConversationDoc {
  _id: string
  id: string
  user: string | { id: string }
  exercise: string | { id: string }
  messages: Array<{ role: string; content: string; timestamp: string }>
  summary?: string
  summaryUpdatedAt?: string
  summaryUntilTimestamp?: string
  contextPolicyVersion: string
  lastMessageAt: string
  createdAt: string
  updatedAt: string
}

async function migrateConversations(options: { dryRun?: boolean } = {}): Promise<MigrationResult> {
  const { dryRun = false } = options
  const results: MigrationResult = {
    success: true,
    processed: 0,
    errors: 0,
    details: [],
  }

  logger.info({ dryRun }, 'Starting conversation context migration')

  try {
    // Get Payload instance
    const payload = await getPayload({ config })

    // Access MongoDB directly for the migration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (payload.db as any).connection.db
    const conversationsCollection = db.collection('conversations')

    // Check if conversations collection exists and has data
    const count = await conversationsCollection.countDocuments()
    logger.info({ count }, 'Found conversations in database')

    if (count === 0) {
      results.details.push('No conversations found to migrate')
      return results
    }

    // Get all conversations that need migration
    // Conversations without contextKey need to be migrated
    const conversationsToMigrate = await conversationsCollection
      .find({
        contextKey: { $exists: false },
      })
      .toArray()

    logger.info({ count: conversationsToMigrate.length }, 'Conversations to migrate')

    if (conversationsToMigrate.length === 0) {
      results.details.push('All conversations already migrated')
      return results
    }

    // Process each conversation
    for (const conv of conversationsToMigrate) {
      try {
        // Extract exercise ID (handle both populated and ID-only cases)
        const exerciseId =
          typeof conv.exercise === 'string'
            ? conv.exercise
            : conv.exercise?.id || conv.exercise?.toString()

        if (!exerciseId) {
          logger.warn({ conversationId: conv.id }, 'Conversation has no exercise, skipping')
          results.errors++
          results.details.push(`Skipped conversation ${conv.id}: no exercise`)
          continue
        }

        // Build contextRef and contextKey
        const contextRef = {
          relationTo: 'exercises' as const,
          value: exerciseId,
        }
        const contextKey = `exercises:${exerciseId}`

        // Prepare update data
        // INVARIANT: Active = archivedAt field is MISSING. Do NOT set archivedAt.
        // Run normalize-conversations-archivedAt.ts after migration to clean up any null values.
        const updateData = {
          contextRef,
          contextKey,
          // Do NOT set archivedAt - active conversations must NOT have this field
          // Keep exercise field for backwards compatibility (marked deprecated in schema)
        }

        if (dryRun) {
          logger.info(
            { conversationId: conv.id, exerciseId, contextKey },
            '[DRY RUN] Would update conversation',
          )
        } else {
          // Perform the update
          await conversationsCollection.updateOne({ _id: conv._id }, { $set: updateData })
          logger.info({ conversationId: conv.id, exerciseId, contextKey }, 'Updated conversation')
        }

        results.processed++
        results.details.push(`Migrated conversation ${conv.id}: ${contextKey}`)
      } catch (error) {
        logger.error({ err: error, conversationId: conv.id }, 'Failed to migrate conversation')
        results.errors++
        results.details.push(
          `Error migrating ${conv.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    }

    // Create unique partial index for active conversations
    // This enforces one active conversation per user+context
    if (!dryRun) {
      try {
        const indexName = 'user_contextKey_active_unique'
        const indexes = await conversationsCollection.indexes()

        if (!indexes.some((idx: any) => idx.name === indexName)) {
          await conversationsCollection.createIndex(
            { user: 1, contextKey: 1 },
            {
              unique: true,
              partialFilterExpression: { archivedAt: { $exists: false } },
              name: indexName,
            },
          )
          logger.info('Created unique partial index for active conversations')
          results.details.push('Created unique partial index: user_contextKey_active_unique')
        } else {
          logger.info('Unique partial index already exists')
          results.details.push('Unique partial index already exists')
        }
      } catch (error) {
        logger.error({ err: error }, 'Failed to create unique index')
        // Don't fail the migration for index creation issues
        results.details.push(
          `Index creation warning: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    }

    results.success = results.errors === 0
    logger.info(
      {
        processed: results.processed,
        errors: results.errors,
        success: results.success,
        dryRun,
      },
      'Migration completed',
    )

    return results
  } catch (error) {
    logger.error({ err: error }, 'Migration failed')
    return {
      success: false,
      processed: results.processed,
      errors: results.errors + 1,
      details: [
        ...results.details,
        `Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run') || args.includes('-d')

  console.log('='.repeat(60))
  console.log('Conversation Context Migration')
  console.log('='.repeat(60))
  console.log(
    `Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be applied)'}`,
  )
  console.log('='.repeat(60))
  console.log('')

  const results = await migrateConversations({ dryRun })

  console.log('')
  console.log('='.repeat(60))
  console.log('Migration Results')
  console.log('='.repeat(60))
  console.log(`Status: ${results.success ? 'SUCCESS' : 'COMPLETED WITH ERRORS'}`)
  console.log(`Processed: ${results.processed}`)
  console.log(`Errors: ${results.errors}`)
  console.log('')
  console.log('Details:')
  results.details.forEach((detail) => console.log(`  - ${detail}`))

  console.log('')
  if (dryRun) {
    console.log('To apply changes, run without --dry-run flag')
  }

  process.exit(results.success ? 0 : 1)
}

// Run if executed directly
main().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})

export { migrateConversations }
