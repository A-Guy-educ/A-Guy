/**
 * Payload Background Task: lesson_duplication
 *
 * Picks up LessonDuplications records with status='pending' and processes them
 * through the duplication orchestrator.
 *
 * This task accepts a duplicationId as input and processes that single record.
 * The caller (endpoint, cron, or webhook) is responsible for scheduling the task
 * when a new pending record is created.
 */

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { runDuplicationOrchestrator } from '@/server/services/lesson-duplication/orchestrator'
import { logger } from '@/infra/utils/logger'

export const lessonDuplicationTask = {
  slug: 'lesson_duplication',
  input: {},
  output: {},

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async handler({ job, req }: any) {
    // Use req.payload when available (from Payload task runner context), fallback to getPayload
    const payload: Payload = req.payload ?? (await getPayload({ config }))

    // Extract duplication ID from job input
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input = (job as any).input as { duplicationId: string } | undefined
    if (!input?.duplicationId) {
      logger.error(
        { jobId: (job as { id?: string }).id },
        'lesson_duplication task called without duplicationId in input',
      )
      throw new Error('duplicationId is required in task input')
    }

    const { duplicationId } = input

    logger.info({ duplicationId }, 'lesson_duplication task started')

    await runDuplicationOrchestrator(duplicationId, payload)

    logger.info({ duplicationId }, 'lesson_duplication task completed')
  },
}
