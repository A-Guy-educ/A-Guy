import { loadRuntimeConfig } from '@/infra/config/runtime/runtime-config'
import { getPdfConversionMaxPromptSizeBytes } from '@/infra/config/system-params'
import type { User } from 'payload'
import { requireAdminOrTestSecret } from '@/server/api/auth'
import { validatePromptForUsageAndTenant } from '@/server/services/exercise-conversion/helpers'
import { hashTextSha256 } from '@/server/utils/hash'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Lesson } from '@/payload-types'

import { queueRequestSchema } from './schema'

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

    // Load runtime config for system params (getPdfConversionMaxPromptSizeBytes)
    await loadRuntimeConfig(payload)

    // Auth: Admin Session OR Test-Only Secret
    const { user } = await payload.auth({ headers: request.headers })
    const authHeader = request.headers.get('authorization')

    try {
      requireAdminOrTestSecret(user as User | null, authHeader)
    } catch {
      return errorResponse('UNAUTHORIZED', 'Admin access required', 401)
    }

    const body = await request.json()
    const parsed = queueRequestSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        `Invalid request body: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
        400,
      )
    }
    const { lessonId, mediaId, extractorPromptId, verifierPromptId } = parsed.data

    // ========== Server-side Tenant Resolution (BEFORE prompt validation) ==========
    // Tenant is directly on the lesson, not through course
    const lesson = await payload.findByID({ collection: 'lessons', id: lessonId, depth: 0 })

    if (!lesson) {
      return errorResponse('LESSON_NOT_FOUND', 'Lesson not found', 404)
    }

    const lessonTyped = lesson as unknown as Lesson
    const tenant = lessonTyped.tenant
    const lessonTenantId = typeof tenant === 'object' ? tenant?.id : tenant
    if (!lessonTenantId) {
      return errorResponse('VALIDATION_ERROR', 'Lesson has no tenant', 400)
    }

    // Validate media belongs to lesson
    const contentFiles = lessonTyped.contentFiles || []
    const mediaIds = contentFiles.map((m): string => (typeof m === 'string' ? m : m.id))
    if (!mediaIds.includes(mediaId)) {
      return errorResponse(
        'MEDIA_NOT_ATTACHED',
        'Media is not attached to this lesson. Save the lesson after attaching media and try again.',
        400,
      )
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
      return errorResponse(
        'PROMPT_NOT_FOUND',
        `Extractor prompt not found: ${extractorPromptId}`,
        400,
      )
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
      return errorResponse(
        'PROMPT_NOT_FOUND',
        `Verifier prompt not found: ${verifierPromptId}`,
        400,
      )
    }

    // Validate verifier prompt (published, usage, tenant)
    validatePromptForUsageAndTenant(verifierPrompt, 'verifier', lessonTenantId)

    // ========== Prompt Size Validation (after validation passes) ==========
    // Use byteLength for accurate size check (UTF-8 encoding)
    const maxPromptSize = await getPdfConversionMaxPromptSizeBytes(lessonTenantId)
    const extractorSize = Buffer.byteLength(extractorPrompt.template, 'utf8')
    if (extractorSize > maxPromptSize) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Extractor prompt template exceeds maximum size',
        400,
      )
    }
    const verifierSize = Buffer.byteLength(verifierPrompt.template, 'utf8')
    if (verifierSize > maxPromptSize) {
      return errorResponse('VALIDATION_ERROR', 'Verifier prompt template exceeds maximum size', 400)
    }

    // ========== Store Prompt Snapshots (Immutability) ==========
    // Use existing hash utility
    const extractorHash = hashTextSha256(extractorPrompt.template)
    const verifierHash = hashTextSha256(verifierPrompt.template)

    // ========== Queue the Job ==========
    const job = await payload.jobs.queue({
      task: 'pdf_to_exercises' as const,
      input: {
        ctx: { lessonId, sourceDocId: mediaId, tenantId: lessonTenantId },
        maxSegmentPages: 2,
        promptRefs: {
          extractorPromptId,
          verifierPromptId,
        },
        promptSnapshot: {
          extractor: extractorPrompt.template,
          verifier: verifierPrompt.template,
        },
        promptSnapshotHash: {
          extractor: extractorHash,
          verifier: verifierHash,
        },
      },
    })

    return NextResponse.json({ success: true, jobId: job.id, message: 'Conversion job queued' })
  } catch (error: unknown) {
    const Sentry = await import('@sentry/nextjs')
    Sentry.captureException(error, { tags: { route: '/api/exercises/convert/queue' } })
    if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
      const typedError = error as { code: string; message: string }
      return errorResponse(typedError.code as ErrorCode, typedError.message, 400)
    }
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500)
  }
}
