/**
 * POST /api/course-selections — handler
 *
 * @fileType endpoint
 * @domain analytics
 * @pattern public-fire-and-forget, hashed-fingerprinting, rate-limited
 * @ai-summary Append a single course-selection event row from the web app
 *
 * Body (Zod-validated):
 * - course: string (course id) — required
 * - source: 'start-page' | 'homepage-greeting' | 'course-card' | 'other' — required
 * - guestId: optional string
 * - gradeLevel: optional string
 *
 * Server-computed (never trust the client):
 * - ipHash: SHA-256 of x-forwarded-for / x-real-ip
 * - userAgentHash: SHA-256 of User-Agent
 * - user: req.user.id if authenticated
 *
 * Rate-limited at ~20 requests/minute per IP hash (in-memory limiter).
 *
 * Called from src/app/api/course-selections/route.ts (Next.js wrapper)
 * because Payload 3.x custom endpoints do not auto-create Next routes.
 */
import '@/infra/config/server-init'

import { logger } from '@/infra/utils/logger'
import config from '@payload-config'
import type { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import { z } from 'zod'

import { hashIP, hashUserAgent } from '@/server/services/guest-session'
import { checkRateLimit } from '@/server/services/rate-limit'

export const COURSE_SELECTION_SOURCES = [
  'start-page',
  'homepage-greeting',
  'course-card',
  'other',
] as const

export type CourseSelectionSource = (typeof COURSE_SELECTION_SOURCES)[number]

const requestSchema = z.object({
  course: z.string().trim().min(1, 'course id is required'),
  source: z.enum(COURSE_SELECTION_SOURCES),
  guestId: z.string().trim().min(1).max(200).optional(),
  gradeLevel: z.string().trim().max(50).optional(),
})

const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60_000

export async function logCourseSelection(request: NextRequest): Promise<Response> {
  const requestId = crypto.randomUUID()
  const reqLogger = logger.child({ requestId })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { course, source, guestId, gradeLevel } = parsed.data

  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ipHash = hashIP(forwardedFor || realIp)
  const userAgentHash = hashUserAgent(request.headers.get('user-agent'))

  const rateLimit = await checkRateLimit(
    ipHash,
    userAgentHash,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS,
  )
  if (!rateLimit.allowed) {
    return Response.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))),
        },
      },
    )
  }

  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })

  try {
    await payload.findByID({
      collection: 'courses',
      id: course,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    return Response.json({ error: 'Course not found' }, { status: 400 })
  }

  const userId = user?.id

  await payload.create({
    collection: 'course-selections',
    data: {
      course,
      ...(userId ? { user: userId } : {}),
      ...(guestId ? { guestId } : {}),
      ...(gradeLevel ? { gradeLevel } : {}),
      source,
      ipHash,
      userAgentHash,
    },
    overrideAccess: true,
  })

  reqLogger.info(
    { courseId: course, source, hasUser: Boolean(userId), hasGuestId: Boolean(guestId) },
    'Course selection logged',
  )

  return Response.json({ success: true })
}
