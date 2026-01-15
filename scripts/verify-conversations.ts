/**
 * Verify Conversations Collection State
 *
 * Checks for duplicate active conversations and offers to clean them up
 * Run: pnpm tsx scripts/verify-conversations.ts
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
  archivedAt?: Date
  lastMessageAt: Date | string // Legacy data may be string
  messages: Array<{ role: string; content: string }>
  updatedAt?: Date
}

async function verifyConversations() {
  const client = new MongoClient(DATABASE_URL)

  try {
    await client.connect()
    console.log('✅ Connected to MongoDB\n')

    const db = client.db()
    const collection = db.collection<Conversation>('conversations')

    // INVARIANT: Active = archivedAt field is MISSING. Archived = archivedAt field EXISTS.
    // Find all active conversations
    const activeConversations = await collection
      .find({ archivedAt: { $exists: false } })
      .sort({ lastMessageAt: -1 })
      .toArray()

    console.log(`📊 Total active conversations: ${activeConversations.length}\n`)

    // Group by (user, exercise) or (user, lesson) to find duplicates
    const groupedByContext = new Map<string, Conversation[]>()

    for (const conv of activeConversations) {
      // Group by exercise if it exists, otherwise by lesson
      // Handle ObjectId or string for user/exercise/lesson
      const userId = typeof conv.user === 'string' ? conv.user : conv.user?.toString() || String(conv.user)
      const exerciseId = conv.exercise ? (typeof conv.exercise === 'string' ? conv.exercise : conv.exercise?.toString() || String(conv.exercise)) : null
      const lessonId = conv.lesson ? (typeof conv.lesson === 'string' ? conv.lesson : conv.lesson?.toString() || String(conv.lesson)) : null

      let key: string
      if (exerciseId) {
        key = `${userId}:exercise:${exerciseId}`
      } else if (lessonId) {
        key = `${userId}:lesson:${lessonId}`
      } else {
        // Skip conversations without exercise or lesson (shouldn't happen in practice)
        console.warn(`⚠️  Conversation ${conv._id} has neither exercise nor lesson, skipping`)
        continue
      }

      if (!groupedByContext.has(key)) {
        groupedByContext.set(key, [])
      }
      groupedByContext.get(key)!.push(conv)
    }

    // Find duplicates
    const duplicates = Array.from(groupedByContext.entries()).filter(
      ([_, convs]) => convs.length > 1,
    )

    if (duplicates.length === 0) {
      console.log('✅ No duplicate active conversations found!')
      console.log('   Database state is consistent.\n')
      return
    }

    console.log(`⚠️  Found ${duplicates.length} contexts with duplicate conversations:\n`)

    let totalDuplicates = 0
    for (const [key, conversations] of duplicates) {
      const parts = key.split(':')
      const userId = parts[0]
      const contextType = parts[1] // 'exercise' or 'lesson'
      const contextId = parts[2]
      console.log(`   Context: ${contextType}:${contextId}`)
      console.log(`   User: ${userId}`)
      console.log(`   Active conversations: ${conversations.length}`)
      console.log(`   Conversations:`)

      conversations.forEach((conv, idx) => {
        const messageCount = conv.messages?.length || 0
        const lastMsg = conv.lastMessageAt ? new Date(conv.lastMessageAt).toISOString() : 'unknown'
        console.log(`     ${idx + 1}. ID: ${conv._id}, Messages: ${messageCount}, Last: ${lastMsg}`)
      })
      console.log()
      totalDuplicates += conversations.length - 1
    }

    console.log(`📊 Summary:`)
    console.log(`   - Contexts with duplicates: ${duplicates.length}`)
    console.log(`   - Total duplicate conversations to clean: ${totalDuplicates}`)
    console.log()
    console.log(`💡 Recommended action: Run cleanup to archive older duplicates`)
    console.log(`   The most recent conversation in each context will be kept active.`)
    console.log()

    // Ask for confirmation to clean up
    console.log(`⚠️  This script will now clean up duplicates automatically.`)
    console.log(`   Press Ctrl+C within 5 seconds to cancel...\n`)

    await new Promise((resolve) => setTimeout(resolve, 5000))

    console.log('🧹 Starting cleanup...\n')

    let archivedCount = 0
    for (const [key, conversations] of duplicates) {
      const parts = key.split(':')
      const contextType = parts[1] // 'exercise' or 'lesson'
      const contextId = parts[2]

      // Sort by lastMessageAt descending (most recent first), fallback to updatedAt
      // Handle lastMessageAt as Date or string (legacy data)
      const sorted = conversations.sort((a, b) => {
        const aTime = new Date(a.lastMessageAt || a.updatedAt || 0).getTime()
        const bTime = new Date(b.lastMessageAt || b.updatedAt || 0).getTime()
        return bTime - aTime
      })

      const toKeep = sorted[0]
      const toArchive = sorted.slice(1)

      console.log(`   Context: ${contextType}:${contextId}`)
      console.log(`   Keeping: ${toKeep._id} (${toKeep.messages?.length || 0} messages)`)

      for (const conv of toArchive) {
        // INVARIANT: Archive by setting archivedAt. Use $set to add the field.
        await collection.updateOne(
          { _id: conv._id },
          { $set: { archivedAt: new Date() } },
        )
        console.log(`   Archived: ${conv._id}`)
        archivedCount++
      }
      console.log()
    }

    console.log(`✅ Cleanup complete!`)
    console.log(`   Archived ${archivedCount} duplicate conversations`)
    console.log(`   Each context now has exactly one active conversation\n`)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await client.close()
    console.log('👋 Disconnected from MongoDB')
  }
}

verifyConversations()
