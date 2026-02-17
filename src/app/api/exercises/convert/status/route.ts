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

      // Determine task slug based on pipelineVersion
      const taskSlug =
        query.pipelineVersion === 2
          ? (TASK_SLUGS.PDF_TO_EXERCISES_V2 as string)
          : TASK_SLUGS.PDF_TO_EXERCISES

      const overrideTaskSlug =
        query.pipelineVersion === 2 ? (TASK_SLUGS.PDF_TO_EXERCISES_V2 as string) : undefined

      const jobs = await jobService.findByContext(
        taskSlug,
        {
          lessonId: query.lessonId,
          sourceDocId: query.mediaId,
        },
        query.limit,
        overrideTaskSlug,
      )

      return apiSuccess({ docs: jobs })
    } catch (error) {
      logger.error({ error }, 'Failed to fetch job statuses')
      return apiError('INTERNAL_ERROR', 'Failed to fetch job statuses', 500)
    }
  },
)
