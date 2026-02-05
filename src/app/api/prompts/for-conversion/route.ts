import { ENV } from '@/server/config/constants'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

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

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // Auth: Admin Session OR Test-Only Secret (same pattern as queue)
    const { user } = await payload.auth({ headers: request.headers })

    let isAdmin = false
    // Check if user is from 'users' collection (has 'role' property)
    // PayloadMcpApiKey doesn't have 'role', so we need to check collection
    if (user && 'collection' in user && user.collection === 'users' && user.role === 'admin') {
      isAdmin = true
    }

    const testSecret = process.env[ENV.TEST_ADMIN_SECRET]
    const authHeader = request.headers.get('authorization')
    if (
      process.env[ENV.NODE_ENV] === 'test' &&
      testSecret &&
      authHeader === `Bearer ${testSecret}`
    ) {
      isAdmin = true
    }

    if (!isAdmin) {
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

    const tenant = (lesson as any).tenant
    const tenantId = tenant?.id || tenant

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

    // Fetch published diagram_generator prompts for this tenant (optional for Diagram Pass)
    const diagramGenerators = await payload.find({
      collection: 'prompts',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { status: { equals: 'published' } },
          { usage: { equals: 'diagram_generator' } },
        ],
      },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })

    // Return in PromptOption format used by UI
    // v2.1 Fix 1: Include status field in response
    return NextResponse.json({
      extractors: extractors.docs.map((p: any) => ({
        id: p.id,
        title: p.title,
        key: p.key,
        type: p.type,
        usage: p.usage,
        status: p.status, // v2.1: Required by tests
      })),
      verifiers: verifiers.docs.map((p: any) => ({
        id: p.id,
        title: p.title,
        key: p.key,
        type: p.type,
        usage: p.usage,
        status: p.status, // v2.1: Required by tests
      })),
      diagramGenerators: diagramGenerators.docs.map((p: any) => ({
        id: p.id,
        title: p.title,
        key: p.key,
        type: p.type,
        usage: p.usage,
        status: p.status,
      })),
    })
  } catch (error) {
    console.error('[PromptsForConversion] Error:', error)
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500)
  }
}
