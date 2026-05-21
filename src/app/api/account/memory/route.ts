/**
 * Account Memory API
 *
 * GET /api/account/memory
 * Returns the authenticated user's memory items, optionally filtered by semantic search.
 *
 * Query params:
 *   - q (optional): Search query for semantic vector search
 *
 * Response:
 *   { memories: MemoryItem[], total: number, searched: boolean }
 *
 * Notes:
 *   - Without q: returns all active memories for the user, ordered by createdAt descending
 *   - With q: performs vector search; falls back to empty results if index unavailable
 *   - Max 100 memories returned per request
 */

import { getPayload } from 'payload'
import { z } from 'zod'

import config from '@payload-config'
import { isVectorIndexAvailable } from '@/infra/llm/vector-index-check'
import { retrieveMemoryItems } from '@/infra/llm/vector-search'
import type { MongooseAdapter } from '@payloadcms/db-mongodb'
import type { Db } from 'mongodb'

const MAX_MEMORIES = 100

const querySchema = z.object({
  q: z.string().optional(),
})

// Shape returned to frontend (excludes embedding field)
export interface ApiMemoryItem {
  _id: string
  userId: string
  conversationId?: string
  contextKey?: string
  contextLevel?: string
  type: string
  text: string
  importance: number
  status: string
  createdAt: string
  updatedAt: string
}

export async function GET(req: Request) {
  const payload = await getPayload({ config })

  // Auth check
  const authResult = await payload.auth({ headers: req.headers })
  if (!authResult.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = authResult.user.id

  // Parse query params
  const url = new URL(req.url)
  const rawQuery = url.searchParams.get('q') || undefined

  const validation = querySchema.safeParse({ q: rawQuery })
  if (!validation.success) {
    return Response.json({ error: 'Invalid query params' }, { status: 400 })
  }

  const { q } = validation.data

  // Get MongoDB db instance for vector search
  const adapter = payload.db as MongooseAdapter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MongoDB driver typing mismatch
  const db = (adapter as any).connection?.db as Db | undefined

  if (q && q.trim().length >= 2 && db) {
    // Semantic search path
    try {
      const indexAvailable = await isVectorIndexAvailable(db)
      if (!indexAvailable) {
        // Vector index unavailable — return empty results
        return Response.json({
          memories: [],
          total: 0,
          searched: true,
        })
      }

      const result = await retrieveMemoryItems(db, userId, q.trim())

      const memories: ApiMemoryItem[] = result.items.map((item) => ({
        _id: item._id,
        userId: item.userId,
        conversationId: item.conversationId ?? undefined,
        contextKey: item.contextKey ?? undefined,
        contextLevel: item.contextLevel ?? undefined,
        type: item.type,
        text: item.text,
        importance: item.importance,
        status: item.status,
        createdAt: String(item.createdAt),
        updatedAt: String(item.updatedAt),
      }))

      return Response.json({
        memories,
        total: memories.length,
        searched: true,
      })
    } catch {
      // Graceful degradation — return empty on vector search failure
      return Response.json({
        memories: [],
        total: 0,
        searched: true,
      })
    }
  } else {
    // List path — fetch all active memories via Payload query
    const result = await payload.find({
      collection: 'memory_items',
      where: {
        and: [{ userId: { equals: userId } }, { status: { equals: 'active' } }],
      },
      sort: '-createdAt', // most recent first
      limit: MAX_MEMORIES,
      overrideAccess: true, // Auth verified above
    })

    const memories: ApiMemoryItem[] = result.docs.map((doc) => ({
      _id: doc.id as string,
      userId: doc.userId,
      conversationId: doc.conversationId ?? undefined,
      contextKey: doc.contextKey ?? undefined,
      contextLevel: doc.contextLevel ?? undefined,
      type: doc.type,
      text: doc.text,
      importance: doc.importance,
      status: doc.status,
      createdAt: String(doc.createdAt),
      updatedAt: String(doc.updatedAt),
    }))

    return Response.json({
      memories,
      total: result.totalDocs,
      searched: false,
    })
  }
}
