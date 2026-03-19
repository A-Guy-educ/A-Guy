/**
 * Teardown preconditions - deletes seeded test data
 * Deletes in reverse dependency order (children first)
 * @fileType utility
 * @domain qa
 * @pattern teardown-data
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import type { ActionRef } from '../actions/types'

// Order matters: delete children before parents
const DELETION_ORDER = ['exercises', 'lessons', 'chapters', 'courses', 'conversations', 'users']

export async function teardownPreconditions(refs: Record<string, ActionRef>): Promise<void> {
  const payload = await getPayload({ config })

  // Sort refs by deletion order
  const sortedEntries = Object.entries(refs).sort(([, a], [, b]) => {
    const aCollection = a._collection
    const bCollection = b._collection
    const aOrder = DELETION_ORDER.indexOf(aCollection)
    const bOrder = DELETION_ORDER.indexOf(bCollection)
    return aOrder - bOrder
  })

  for (const [, doc] of sortedEntries) {
    const collection = doc._collection as
      | 'users'
      | 'courses'
      | 'chapters'
      | 'lessons'
      | 'exercises'
      | 'conversations'

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (payload as any).delete({
        collection,
        id: doc.id,
        overrideAccess: true,
      })
    } catch {
      // Silently continue - entity may have been cascade-deleted or already gone
    }
  }
}
