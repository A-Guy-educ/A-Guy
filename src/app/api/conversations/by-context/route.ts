import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { logger } from '@/infra/utils/logger/logger'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const contextKey = searchParams.get('contextKey')
    const contextKeyPrefix = searchParams.get('contextKeyPrefix')
    const limit = Math.min(Number(searchParams.get('limit') ?? 100), 100)

    if (!contextKey && !contextKeyPrefix) {
      return NextResponse.json(
        { error: 'contextKey or contextKeyPrefix is required' },
        { status: 400 },
      )
    }

    const contextFilter = contextKey
      ? { contextKey: { equals: contextKey } }
      : { contextKey: { like: contextKeyPrefix } }

    const result = await payload.find({
      collection: 'conversations',
      where: {
        and: [{ user: { equals: user.id } }, contextFilter, { archivedAt: { exists: false } }],
      },
      sort: '-lastMessageAt',
      limit,
      pagination: false,
      depth: 0,
      user,
      overrideAccess: false,
    })

    const conversations = result.docs.map((doc) => {
      const docTitle = (doc as unknown as { title?: string }).title
      return {
        id: doc.id,
        contextKey: doc.contextKey,
        title: docTitle ?? getPreviewTitle(doc.messages ?? undefined),
        lastMessageAt: doc.lastMessageAt,
        messageCount: doc.messages?.filter((m) => !m.hidden).length ?? 0,
      }
    })

    return NextResponse.json({ conversations, total: result.totalDocs })
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch conversations by context')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const courseId = body.courseId as string | undefined
    const requestLocale = body.locale as string | undefined

    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
    }

    const contextKey = `ask:${courseId}:${Date.now()}`

    // Resolve preferredLocale with fallback chain:
    // 1. Request body locale
    // 2. Course's locale setting
    // 3. Default to 'he'
    type LocaleOption = 'en' | 'he'
    let preferredLocale: LocaleOption = 'he'

    if (requestLocale === 'en' || requestLocale === 'he') {
      preferredLocale = requestLocale
    } else {
      // Fall back to course's locale
      const course = await payload.findByID({
        collection: 'courses',
        id: courseId,
        depth: 0,
        select: { locale: true },
        overrideAccess: true, // Need to fetch course info without user access
      })

      const courseLocale = (course as { locale?: string })?.locale
      if (courseLocale === 'en' || courseLocale === 'he') {
        preferredLocale = courseLocale
      }
    }

    const conversation = await payload.create({
      collection: 'conversations',
      data: {
        user: user.id,
        contextRef: { relationTo: 'courses', value: courseId },
        contextKey,
        messages: [],
        lastMessageAt: new Date().toISOString(),
        contextPolicyVersion: 'v1',
        preferredLocale,
      },
      draft: false,
      user,
      overrideAccess: false,
    })

    return NextResponse.json({ id: conversation.id, contextKey })
  } catch (error) {
    logger.error({ err: error }, 'Failed to create conversation')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    await payload.update({
      collection: 'conversations',
      id,
      data: { archivedAt: new Date().toISOString() } as Record<string, unknown>,
      user,
      overrideAccess: false,
      context: { allowArchive: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete conversation')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function getPreviewTitle(
  messages?: Array<{ role: string; content: string; hidden?: boolean | null }>,
) {
  const firstUserMsg = messages?.find((m) => m.role === 'user' && !m.hidden)
  if (!firstUserMsg) return ''
  return firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '')
}
