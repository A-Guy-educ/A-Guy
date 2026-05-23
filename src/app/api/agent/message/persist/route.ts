/**
 * POST /api/agent/message/persist
 * Persist an assistant message directly to a conversation (no AI call).
 * Used for CMS-authored help content (hints, solutions) that should survive page refresh.
 */
import '@/infra/config/server-init'

import { logger } from '@/infra/utils/logger/logger'
import { getGuestSessionByToken, getGuestSessionCookie } from '@/server/services/guest-session'
import config from '@payload-config'
import { DEFAULT_CONTENT_LOCALE } from '@/server/payload/fields/contentLocale'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import { z } from 'zod'

const requestSchema = z.object({
  contextKey: z.string().min(1),
  content: z.string().min(1).max(5000),
})

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const reqLogger = logger.child({ requestId })

  try {
    const body = await request.json()
    const validated = requestSchema.parse(body)

    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    // Support both authenticated users and guest sessions
    let guestSessionId: string | null = null
    if (!user) {
      const guestToken = getGuestSessionCookie(request.headers)
      if (guestToken) {
        const guestSession = await getGuestSessionByToken(payload, guestToken)
        if (guestSession) {
          guestSessionId = guestSession.id
        }
      }
    }

    if (!user && !guestSessionId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const ownerId = user?.id ?? guestSessionId!

    // Find active conversation for this context
    const whereClause: Where = guestSessionId
      ? {
          and: [
            { guestSession: { equals: guestSessionId } },
            { contextKey: { equals: validated.contextKey } },
            { archivedAt: { exists: false } },
          ],
        }
      : {
          and: [
            { user: { equals: ownerId } },
            { contextKey: { equals: validated.contextKey } },
            { archivedAt: { exists: false } },
          ],
        }

    const result = await payload.find({
      collection: 'conversations',
      where: whereClause,
      limit: 1,
      sort: '-lastMessageAt',
      user: guestSessionId ? undefined : (user ?? undefined),
      overrideAccess: !!guestSessionId,
    })

    let conversationId: string
    let existingMessages: unknown[] = []

    if (result.docs.length === 0) {
      // No conversation exists — create one (bug #1847 fix)
      reqLogger.info(
        { ownerId, contextKey: validated.contextKey },
        'No conversation found for message persist, creating new conversation',
      )

      // Parse contextKey to get relationTo and value (e.g., "lessons:abc123")
      const colonIndex = validated.contextKey.indexOf(':')
      const relationTo = colonIndex !== -1 ? validated.contextKey.slice(0, colonIndex) : 'lessons'
      const value =
        colonIndex !== -1 ? validated.contextKey.slice(colonIndex + 1) : validated.contextKey

      // Validate that the referenced document actually exists before creating the conversation.
      // This prevents Payload relationship validation errors (HTTP 500) when a non-existent
      // document ID is passed (e.g., test scenarios with fake IDs or stale contextKey values).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let contextRef: any = undefined
      try {
        const docExists = await payload.find({
          collection: relationTo as any,
          where: { id: { equals: value } },
          limit: 1,
          depth: 0,
          user: user ?? undefined,
          overrideAccess: !!guestSessionId,
        })
        if (docExists.docs.length > 0) {
          contextRef = { relationTo, value }
        }
      } catch {
        // Relationship validation will catch invalid collection names; proceed without contextRef
      }

      const conversationData: Record<string, unknown> = {
        ...(guestSessionId ? { guestSession: guestSessionId } : { user: ownerId }),
        contextKey: validated.contextKey,
        preferredLocale: DEFAULT_CONTENT_LOCALE,
        messages: [],
        lastMessageAt: new Date().toISOString(),
        contextPolicyVersion: 'v1',
      }
      if (contextRef) {
        conversationData.contextRef = contextRef
      }

      const newConversation = await payload.create({
        collection: 'conversations',
        data: conversationData as any,
        user: user ?? undefined,
        overrideAccess: !!guestSessionId,
      })
      conversationId = newConversation.id
    } else {
      conversationId = result.docs[0].id
      existingMessages = result.docs[0].messages ?? []
    }

    const assistantMessage = {
      role: 'assistant' as const,
      content: validated.content,
      timestamp: new Date().toISOString(),
      hidden: false,
    }

    await payload.update({
      collection: 'conversations',
      id: conversationId,
      data: {
        messages: [...(existingMessages as never[]), assistantMessage],
        lastMessageAt: new Date().toISOString(),
      },
      user: user ?? undefined,
      overrideAccess: !!guestSessionId,
    })

    reqLogger.info(
      { conversationId, contextKey: validated.contextKey },
      'Assistant message persisted',
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: error.issues }, { status: 400 })
    }

    const { captureAndRespond } = await import('@/server/api/capture-and-respond')
    return captureAndRespond(error, { route: '/api/agent/message/persist', requestId })
  }
}
