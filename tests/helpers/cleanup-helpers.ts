/**
 * Reusable cleanup helpers for integration tests
 *
 * These helpers delete test-generated data by known identifiers
 * (user IDs, collection filters, etc.) without affecting
 * production or seeded data.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Payload } from 'payload'

/**
 * Delete all conversations belonging to a user
 */
export async function cleanupUserConversations(payload: Payload, userId: string): Promise<number> {
  const conversations = await payload.find({
    collection: 'conversations',
    where: { user: { equals: userId } },
    limit: 1000,
    overrideAccess: true,
  })

  for (const conv of conversations.docs) {
    await payload.delete({
      collection: 'conversations',
      id: conv.id,
      overrideAccess: true,
    })
  }

  return conversations.docs.length
}

/**
 * Delete all memory items belonging to a user
 */
export async function cleanupUserMemories(payload: Payload, userId: string): Promise<number> {
  const memories = await payload.find({
    collection: 'memory_items',
    where: { userId: { equals: userId } },
    limit: 1000,
    overrideAccess: true,
  })

  for (const mem of memories.docs) {
    await payload.delete({
      collection: 'memory_items',
      id: mem.id,
      overrideAccess: true,
    })
  }

  return memories.docs.length
}

/**
 * Delete all progress records belonging to a user
 */
export async function cleanupUserProgress(payload: Payload, userId: string): Promise<number> {
  const records = await payload.find({
    collection: 'user-progress',
    where: { user: { equals: userId } },
    limit: 1000,
    overrideAccess: true,
  })

  for (const record of records.docs) {
    await payload.delete({
      collection: 'user-progress',
      id: record.id,
      overrideAccess: true,
    })
  }

  return records.docs.length
}

/**
 * Delete a user and all their associated data
 * Cleans up in dependency order: memories, conversations,
 * progress, settings, then the user itself.
 */
export async function cleanupUserAndRelatedData(payload: Payload, userId: string): Promise<void> {
  if (!userId) return

  try {
    await cleanupUserMemories(payload, userId)
  } catch {
    // Best effort
  }

  try {
    await cleanupUserConversations(payload, userId)
  } catch {
    // Best effort
  }

  try {
    await cleanupUserProgress(payload, userId)
  } catch {
    // Best effort
  }

  try {
    const settings = await payload.find({
      collection: 'user_settings',
      where: { user: { equals: userId } },
      limit: 10,
      overrideAccess: true,
    })
    for (const setting of settings.docs) {
      await payload.delete({
        collection: 'user_settings',
        id: setting.id,
        overrideAccess: true,
      })
    }
  } catch {
    // Best effort
  }

  try {
    await payload.delete({
      collection: 'users',
      id: userId,
      overrideAccess: true,
    })
  } catch {
    // Best effort - user may already be deleted
  }
}

/**
 * Delete guest sessions matching a filter
 */
export async function cleanupGuestSessions(
  payload: Payload,
  where: Record<string, unknown>,
): Promise<number> {
  const sessions = await payload.find({
    collection: 'guest-sessions',
    where: where as any,
    limit: 1000,
    overrideAccess: true,
  })

  for (const session of sessions.docs) {
    await payload.delete({
      collection: 'guest-sessions',
      id: session.id,
      overrideAccess: true,
    })
  }

  return sessions.docs.length
}

/**
 * Clean up a full content hierarchy: exercises -> lessons -> chapters -> courses -> categories
 * Pass IDs of records YOUR test created. Does not delete pre-existing/seeded data.
 */
export async function cleanupContentHierarchy(
  payload: Payload,
  ids: {
    exerciseIds?: string[]
    lessonIds?: string[]
    chapterIds?: string[]
    courseIds?: string[]
    categoryIds?: string[]
    mediaIds?: string[]
    promptIds?: string[]
  },
): Promise<void> {
  const deleteMany = async (collection: string, idList?: string[]) => {
    if (!idList?.length) return
    for (const id of idList) {
      try {
        await (payload as any).delete({
          collection,
          id,
          overrideAccess: true,
        })
      } catch {
        // Best effort - record may not exist
      }
    }
  }

  // Delete in dependency order (children first)
  await deleteMany('exercises', ids.exerciseIds)
  await deleteMany('lessons', ids.lessonIds)
  await deleteMany('chapters', ids.chapterIds)
  await deleteMany('courses', ids.courseIds)
  await deleteMany('categories', ids.categoryIds)
  await deleteMany('media', ids.mediaIds)
  await deleteMany('prompts', ids.promptIds)
}
