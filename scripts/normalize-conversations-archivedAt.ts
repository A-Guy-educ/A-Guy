/**
 * Normalize Conversations archivedAt Field
 *
 * One-time, idempotent script to normalize archivedAt field in conversations.
 *
 * Actions:
 * 1. Find docs with archivedAt: null → $unset archivedAt (remove field)
 * 2. Detect duplicates among active docs per (user, exercise) / (user, lesson):
 *    - Keep the most recent by lastMessageAt (fallback updatedAt)
 *    - Archive all others: archivedAt = new Date()
 *
 * INVARIANT: Active = archivedAt field is MISSING. Archived = archivedAt field EXISTS.
 *
 * Run: pnpm tsx scripts/normalize-conversations-archivedAt.ts
 */

import { config } from 'dotenv'
import { MongoClient } from 'mongodb'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required')
  process.exit(1)
}

interface Conversation {
  _id: any // ObjectId or string
  user: any // ObjectId or string (Payload relationships)
  exercise?: any // ObjectId or string (Payload relationships)
  lesson?: any // ObjectId or string (Payload relationships)
  archivedAt?: Date | null
  lastMessageAt: Date | string // Legacy data may be string
  updatedAt?: Date
  messages: Array<{ role: string; content: string }>
}

async function normalizeConversations() {
  const client = new MongoClient(DATABASE_URL)

  try {
    await client.connect()
    console.log('✅ Connected to MongoDB\n')

    const db = client.db()
    const collection = db.collection<Conversation>('conversations')

    // Step 1: Remove archivedAt: null (should be missing field instead)
    console.log('🔍 Step 1: Finding conversations with archivedAt: null...')
    const nullArchivedDocs = await collection.find({ archivedAt: null }).toArray()

    if (nullArchivedDocs.length > 0) {
      console.log(`   Found ${nullArchivedDocs.length} conversations with archivedAt: null`)
      console.log('   Removing archivedAt field from these documents...')

      for (const doc of nullArchivedDocs) {
        await collection.updateOne({ _id: doc._id }, { $unset: { archivedAt: '' } })
      }

      console.log(`   ✅ Removed archivedAt field from ${nullArchivedDocs.length} documents\n`)
    } else {
      console.log('   ✅ No conversations with archivedAt: null found\n')
    }

    // Step 2: Find active conversations (archivedAt field missing)
    console.log('🔍 Step 2: Finding active conversations (archivedAt field missing)...')
    const activeConversations = await collection.find({ archivedAt: { $exists: false } }).toArray()

    console.log(`   Found ${activeConversations.length} active conversations\n`)

    // Step 3: Group by (user, exercise) or (user, lesson) to find duplicates
    console.log('🔍 Step 3: Grouping by context to find duplicates...')
    const groupedByContext = new Map<string, Conversation[]>()

    for (const conv of activeConversations) {
      let key: string
      // Handle ObjectId or string for user/exercise/lesson
      const userId =
        typeof conv.user === 'string' ? conv.user : conv.user?.toString() || String(conv.user)
      const exerciseId = conv.exercise
        ? typeof conv.exercise === 'string'
          ? conv.exercise
          : conv.exercise?.toString() || String(conv.exercise)
        : null
      const lessonId = conv.lesson
        ? typeof conv.lesson === 'string'
          ? conv.lesson
          : conv.lesson?.toString() || String(conv.lesson)
        : null

      if (exerciseId) {
        key = `${userId}:exercise:${exerciseId}`
      } else if (lessonId) {
        key = `${userId}:lesson:${lessonId}`
      } else {
        // Skip conversations without exercise or lesson
        console.warn(`   ⚠️  Conversation ${conv._id} has neither exercise nor lesson, skipping`)
        continue
      }

      if (!groupedByContext.has(key)) {
        groupedByContext.set(key, [])
      }
      groupedByContext.get(key)!.push(conv)
    }

    // Find duplicates (groups with more than 1 conversation)
    const duplicates = Array.from(groupedByContext.entries()).filter(
      ([_, convs]) => convs.length > 1,
    )

    if (duplicates.length === 0) {
      console.log('   ✅ No duplicate active conversations found!')
      console.log('   Database state is consistent.\n')
      return
    }

    console.log(`   ⚠️  Found ${duplicates.length} contexts with duplicate conversations\n`)

    // Step 4: Archive duplicates (keep most recent)
    console.log('🔧 Step 4: Archiving duplicate conversations (keeping most recent)...\n')

    let archivedCount = 0
    for (const [key, conversations] of duplicates) {
      const parts = key.split(':')
      const contextType = parts[1] // 'exercise' or 'lesson'
      const contextId = parts[2]

      // Sort by lastMessageAt descending (most recent first), fallback to updatedAt
      const sorted = conversations.sort((a, b) => {
        const aTime = new Date(a.lastMessageAt || a.updatedAt || 0).getTime()
        const bTime = new Date(b.lastMessageAt || b.updatedAt || 0).getTime()
        return bTime - aTime
      })

      const toKeep = sorted[0]
      const toArchive = sorted.slice(1)

      console.log(`   Context: ${contextType}:${contextId}`)
      console.log(
        `   Keeping: ${toKeep._id} (${toKeep.messages?.length || 0} messages, last: ${new Date(toKeep.lastMessageAt || toKeep.updatedAt || 0).toISOString()})`,
      )

      for (const conv of toArchive) {
        // INVARIANT: Archive by setting archivedAt. Use $set to add the field.
        await collection.updateOne({ _id: conv._id }, { $set: { archivedAt: new Date() } })
        console.log(
          `   Archived: ${conv._id} (${conv.messages?.length || 0} messages, last: ${new Date(conv.lastMessageAt || conv.updatedAt || 0).toISOString()})`,
        )
        archivedCount++
      }
      console.log()
    }

    console.log('✅ Normalization complete!')
    console.log(`   - Removed archivedAt: null from ${nullArchivedDocs.length} documents`)
    console.log(`   - Archived ${archivedCount} duplicate conversations`)
    console.log(`   - Each context now has exactly one active conversation\n`)

    // Verification: Check for remaining duplicates
    console.log('🔍 Verification: Checking for remaining duplicates...')
    const remainingActive = await collection.find({ archivedAt: { $exists: false } }).toArray()

    const remainingGrouped = new Map<string, Conversation[]>()
    for (const conv of remainingActive) {
      let key: string
      // Handle ObjectId or string for user/exercise/lesson
      const userId =
        typeof conv.user === 'string' ? conv.user : conv.user?.toString() || String(conv.user)
      const exerciseId = conv.exercise
        ? typeof conv.exercise === 'string'
          ? conv.exercise
          : conv.exercise?.toString() || String(conv.exercise)
        : null
      const lessonId = conv.lesson
        ? typeof conv.lesson === 'string'
          ? conv.lesson
          : conv.lesson?.toString() || String(conv.lesson)
        : null

      if (exerciseId) {
        key = `${userId}:exercise:${exerciseId}`
      } else if (lessonId) {
        key = `${userId}:lesson:${lessonId}`
      } else {
        continue
      }

      if (!remainingGrouped.has(key)) {
        remainingGrouped.set(key, [])
      }
      remainingGrouped.get(key)!.push(conv)
    }

    const remainingDuplicates = Array.from(remainingGrouped.entries()).filter(
      ([_, convs]) => convs.length > 1,
    )

    if (remainingDuplicates.length === 0) {
      console.log('   ✅ No remaining duplicates found!')
    } else {
      console.log(`   ⚠️  Warning: ${remainingDuplicates.length} contexts still have duplicates`)
      console.log('   This may indicate an issue with the normalization process.')
    }
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await client.close()
    console.log()
    console.log('👋 Disconnected from MongoDB')
  }
}

normalizeConversations()
