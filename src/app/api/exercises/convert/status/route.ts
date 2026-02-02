import { apiError, apiSuccess } from '@/server/api/responses'
import { jobStatusQuerySchema } from '@/server/api/schemas/job-schemas'
import { withApiHandler } from '@/server/api/with-api-handler'
import { TASK_SLUGS } from '@/server/payload/jobs/constants'
import { JobService } from '@/server/payload/services/job-service'

export const GET = withApiHandler(
  { auth: 'adminOrTest', querySchema: jobStatusQuerySchema },
  async ({ payload, query, logger }) => {
    try {
      const jobService = JobService.fromPayload(payload)
      const jobs = await jobService.findByContext(
        TASK_SLUGS.PDF_TO_EXERCISES,
        {
          lessonId: query.lessonId,
          sourceDocId: query.mediaId,
        },
        query.limit,
      )

      return apiSuccess({ docs: jobs })
    } catch (error) {
      logger.error({ error }, 'Failed to fetch job statuses')
      return apiError('INTERNAL_ERROR', 'Failed to fetch job statuses', 500)
    }
  },
)
