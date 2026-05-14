/**
 * Manual orchestrator trigger for a single LessonDuplications record.
 *
 * POST /api/lesson-duplications/:id/process-now
 *
 * Admin-only. Calls runDuplicationOrchestrator on the record with the same
 * deadline behaviour as the cron worker: process as many exercises as fit in
 * the Vercel function lifetime, then return. If work remains, the record
 * stays in `running` and the next cron tick (or manual click) continues from
 * there.
 *
 * Use cases:
 *  - Dev environments where Vercel cron schedules don't fire (preview tier).
 *  - Production "kick now" for an admin who doesn't want to wait for the
 *    next 1-minute cron tick.
 *  - Resuming a record that the cron worker skipped (e.g. lock held by a
 *    crashed previous tick — though those expire in CLAIM_LOCK_MS).
 */
import { withApiHandler } from '@/server/api/with-api-handler'
import { apiSuccess, ApiErrors } from '@/server/api/responses'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { runDuplicationOrchestrator } from '@/server/services/lesson-duplication/orchestrator'

// Match the cron worker's budget so an admin click has the same ceiling as
// a cron tick — no surprise differences in how much progress each makes.
export const maxDuration = 800
const HEADROOM_MS = 30_000

export const POST = withApiHandler<unknown, unknown>({ auth: 'admin' }, async ({ request }) => {
  const url = new URL(request.url || 'http://localhost')
  const match = url.pathname.match(/\/lesson-duplications\/([^/]+)\/process-now/)
  const duplicationId = match?.[1]
  if (!duplicationId) return ApiErrors.notFound('duplication id')

  const payload = await getPayload({ config: configPromise })

  const startedAt = Date.now()
  const deadlineMs = startedAt + (maxDuration * 1000 - HEADROOM_MS)

  const outcome = await runDuplicationOrchestrator(duplicationId, payload, undefined, {
    deadlineMs,
  })

  return apiSuccess({
    duplicationId,
    outcome,
    elapsedMs: Date.now() - startedAt,
  })
})
