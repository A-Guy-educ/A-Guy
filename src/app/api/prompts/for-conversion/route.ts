import type { User } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Lesson, Prompt } from '@/payload-types'
import { requireAdminOrTestSecret } from '@/server/api/auth'

type ErrorCode =
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'LESSON_NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'METHOD_NOT_ALLOWED'

function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  headers?: Record<string, string>,
): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status, headers })
}

// v2.1 Fix 2: GET returns 405 Method Not Allowed
export async function GET() {
  return errorResponse('METHOD_NOT_ALLOWED', 'Use POST', 405, { Allow: 'POST' })
}

interface PromptOption {
  id: string
  title: string
  key: string
  type: string
  usage: string
  status: string
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // Auth: Admin Session OR Test-Only Secret
    const { user } = await payload.auth({ headers: request.headers })
    const authHeader = request.headers.get('authorization')

    try {
      requireAdminOrTestSecret(user as User | null, authHeader)
    } catch {
      return errorResponse('UNAUTHORIZED', 'Admin access required', 401)
    }

    const body = await request.json()
    const { lessonId } = body

    if (!lessonId) {
      return errorResponse('VALIDATION_ERROR', 'lessonId is required', 400)
    }

    // Server-side tenant resolution: tenant is directly on the lesson (not through course)
    const lesson = await payload.findByID({ collection: 'lessons', id: lessonId, depth: 0 })

    if (!lesson) {
      return errorResponse('LESSON_NOT_FOUND', 'Lesson not found', 404)
    }

    const lessonTyped = lesson as unknown as Lesson
    const tenant = lessonTyped.tenant
    const tenantId = typeof tenant === 'object' ? (tenant?.id ?? null) : tenant

    if (!tenantId) {
      return errorResponse('VALIDATION_ERROR', 'Lesson has no tenant', 400)
    }

    // Fetch published extractor prompts for this tenant
    const extractors = await payload.find({
      collection: 'prompts',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { status: { equals: 'published' } },
          { usage: { equals: 'extractor' } },
        ],
      },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })

    // Fetch published verifier prompts for this tenant
    const verifiers = await payload.find({
      collection: 'prompts',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { status: { equals: 'published' } },
          { usage: { equals: 'verifier' } },
        ],
      },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })

    // Return in PromptOption format used by UI
    // v2.1 Fix 1: Include status field in response
    const mapPromptToOption = (p: Prompt): PromptOption => ({
      id: p.id,
      title: p.title ?? '',
      key: p.key ?? '',
      type: p.type ?? '',
      usage: p.usage ?? '',
      status: p.status ?? 'draft',
    })

    return NextResponse.json({
      extractors: extractors.docs.map(mapPromptToOption),
      verifiers: verifiers.docs.map(mapPromptToOption),
    })
  } catch (error) {
    console.error('[PromptsForConversion] Error:', error)
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500)
  }
}
