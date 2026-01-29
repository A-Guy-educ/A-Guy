import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { ENV, TASK_SLUG, MAX_PROMPT_SIZE_BYTES } from '@/server/config/constants'
import { hashTextSha256 } from '@/server/utils/hash'
import { validatePromptForUsageAndTenant } from '@/lib/exercise-conversion/helpers'

type ErrorCode =
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'CONVERSION_ALREADY_RUNNING'
  | 'PROMPT_NOT_FOUND'
  | 'PROMPT_NOT_PUBLISHED'
  | 'PROMPT_TENANT_MISMATCH'
  | 'PROMPT_USAGE_MISMATCH'
  | 'LESSON_NOT_FOUND'
  | 'MEDIA_NOT_ATTACHED'
  | 'INTERNAL_ERROR'

function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  extra?: object,
): NextResponse {
  return NextResponse.json({ error: { code, message }, ...extra }, { status })
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // Auth: Admin Session OR Test-Only Secret
    const { user } = await payload.auth({ headers: request.headers })

    let isAdmin = false
    if (user && Array.isArray(user.roles) && user.roles.includes('admin')) {
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

    const { lessonId, mediaId, extractorPromptId, verifierPromptId } = await request.json()

    if (!lessonId || !mediaId || !extractorPromptId || !verifierPromptId) {
      return errorResponse('VALIDATION_ERROR', 'All fields are required', 400)
    }

    // ========== Server-side Tenant Resolution (BEFORE prompt validation) ==========
    const lesson = await payload.findByID({ collection: 'lessons', id: lessonId, depth: 2 })

    if (!lesson) {
      return errorResponse('LESSON_NOT_FOUND', 'Lesson not found', 404)
    }

    // Get tenant from lesson's course (authoritative source)
    const course = lesson.course
    const lessonTenantId = course?.tenant?.id || course?.tenant
    if (!lessonTenantId) {
      return errorResponse('VALIDATION_ERROR', 'Lesson has no tenant', 400)
    }

    // Validate media belongs to lesson
    const mediaIds = (lesson.media || []).map((m: any) => (typeof m === 'string' ? m : m.id))
    if (!mediaIds.includes(mediaId)) {
      return errorResponse('MEDIA_NOT_ATTACHED', 'Media is not attached to this lesson', 400)
    }

    // ========== Fetch and Validate Prompts (with overrideAccess: true) ==========
    // Fetch extractor prompt once
    const extractorPrompt = await payload.findByID({
      collection: 'prompts',
      id: extractorPromptId,
      depth: 0,
      overrideAccess: true,
    })

    // v2.1 Fix 8: Check prompt exists before validation
    if (!extractorPrompt) {
      return errorResponse('PROMPT_NOT_FOUND', `Extractor prompt not found: ${extractorPromptId}`, 400)
    }

    // Validate extractor prompt (published, usage, tenant)
    validatePromptForUsageAndTenant(extractorPrompt, 'extractor', lessonTenantId)

    // Fetch verifier prompt once
    const verifierPrompt = await payload.findByID({
      collection: 'prompts',
      id: verifierPromptId,
      depth: 0,
      overrideAccess: true,
    })

    // v2.1 Fix 8: Check prompt exists before validation
    if (!verifierPrompt) {
      return errorResponse('PROMPT_NOT_FOUND', `Verifier prompt not found: ${verifierPromptId}`, 400)
    }

    // Validate verifier prompt (published, usage, tenant)
    validatePromptForUsageAndTenant(verifierPrompt, 'verifier', lessonTenantId)

    // ========== Prompt Size Validation (after validation passes) ==========
    // Use byteLength for accurate size check (UTF-8 encoding)
    const extractorSize = Buffer.byteLength(extractorPrompt.template, 'utf8')
    if (extractorSize > MAX_PROMPT_SIZE_BYTES) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Extractor prompt template exceeds maximum size',
        400,
      )
    }
    const verifierSize = Buffer.byteLength(verifierPrompt.template, 'utf8')
    if (verifierSize > MAX_PROMPT_SIZE_BYTES) {
      return errorResponse('VALIDATION_ERROR', 'Verifier prompt template exceeds maximum size', 400)
    }

    // ========== Queue Policy Check (Idempotency) ==========
    // Block duplicates for same (lessonId, mediaId) when status is queued OR running
    const now = new Date()
    const existingJobs = await payload.find({
      collection: 'jobs',
      where: {
        and: [
          { taskSlug: { equals: TASK_SLUG } },
          { 'input.ctx.lessonId': { equals: lessonId } },
          { 'input.ctx.sourceDocId': { equals: mediaId } },
          {
            or: [
              { status: { equals: 'queued' } },
              {
                and: [
                  { status: { equals: 'running' } },
                  { lockExpiresAt: { greater_than: now } },
                ],
              },
            ],
          },
        ],
      },
      limit: 1,
      pagination: false,
    })

    if (existingJobs.docs.length > 0) {
      return errorResponse('CONVERSION_ALREADY_RUNNING', 'A conversion is already queued or running', 409, {
        runningJobId: existingJobs.docs[0].id,
      })
    }

    // ========== Store Prompt Snapshots (Immutability) ==========
    // Use existing hash utility
    const extractorHash = hashTextSha256(extractorPrompt.template)
    const verifierHash = hashTextSha256(verifierPrompt.template)

    // ========== Queue the Job ==========
    const job = await payload.jobs.queue({
      taskSlug: TASK_SLUG,
      input: {
        ctx: { lessonId, sourceDocId: mediaId, tenantId: lessonTenantId },
        maxSegmentPages: 2,
        promptRefs: { extractorPromptId, verifierPromptId },
        promptSnapshot: { extractor: extractorPrompt.template, verifier: verifierPrompt.template },
        promptSnapshotHash: { extractor: extractorHash, verifier: verifierHash },
      },
    })

    return NextResponse.json({ success: true, jobId: job.id, message: 'Conversion job queued' })
  } catch (error: any) {
    console.error('[Queue] Error:', error)
    if (error && typeof error === 'object' && 'code' in error) {
      return errorResponse(error.code, error.message, 400)
    }
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500)
  }
}
