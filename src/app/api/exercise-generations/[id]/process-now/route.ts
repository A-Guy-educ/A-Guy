/**
 * POST /api/exercise-generations/:id/process-now
 *
 * Manually triggers the orchestrator for a specific record.
 * Used for dev (where Vercel cron doesn't fire) and "do it now" in prod.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { logger } from '@/infra/utils/logger'
import { runExerciseGenerationOrchestrator } from '@/server/services/exercise-generation/orchestrator'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })

    // Verify record exists
    const record = await payload.findByID({
      collection: 'exercise-generations',
      id,
      depth: 0,
      overrideAccess: true,
    })

    if (!record) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    logger.info({ generationId: id }, '[exercise-generation/process-now] Starting')

    const deadlineMs = Date.now() + 10 * 60 * 1000 // 10 minute budget for manual trigger

    let outcome: string
    try {
      outcome = await runExerciseGenerationOrchestrator(id, payload, { deadlineMs })
    } catch (err) {
      logger.error(
        { err, generationId: id },
        '[exercise-generation/process-now] Orchestrator threw',
      )
      outcome = 'failed'
    }

    return NextResponse.json({
      data: { outcome },
    })
  } catch (error) {
    console.error('Error processing exercise-generation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
