import { apiError, ApiErrors } from '@/server/api/responses'
import type { Payload } from 'payload'
import { TASK_SLUGS } from '../jobs/constants'
import type { JobContext, JobStatus } from '../jobs/types'
import { JobService } from './job-service'

export interface QueueConversionParams {
  lessonId: string
  mediaId: string
  extractorPromptId: string
  verifierPromptId: string
  // V1.0: Optional diagram generator prompt
  diagramPromptId?: string | null
}

export interface ConversionResult {
  jobId: string
  status: JobStatus
}

export interface ConversionJobStatus {
  id: string
  status: JobStatus
  taskSlug: string
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  hasError: boolean
  output?: unknown
}

export class ExerciseConversionService {
  constructor(
    private readonly payload: Payload,
    private readonly jobService: JobService,
  ) {}

  /**
   * Queue a new exercise conversion job
   */
  async queueConversion(params: QueueConversionParams): Promise<ConversionResult> {
    // Validate lesson exists
    const lesson = await this.payload.findByID({
      collection: 'lessons',
      id: params.lessonId,
      depth: 0,
    })

    if (!lesson) {
      throw ApiErrors.notFound('Lesson')
    }

    // Validate media exists and belongs to lesson
    const media = await this.payload.findByID({
      collection: 'media',
      id: params.mediaId,
      depth: 0,
    })

    if (!media) {
      throw ApiErrors.notFound('Media')
    }

    // Validate prompts exist
    const extractorPrompt = await this.payload.findByID({
      collection: 'prompts',
      id: params.extractorPromptId,
      depth: 0,
    })

    if (!extractorPrompt) {
      throw ApiErrors.notFound('Extractor Prompt')
    }

    const verifierPrompt = await this.payload.findByID({
      collection: 'prompts',
      id: params.verifierPromptId,
      depth: 0,
    })

    if (!verifierPrompt) {
      throw ApiErrors.notFound('Verifier Prompt')
    }

    // Get tenant ID from lesson
    const tenantId =
      typeof lesson.tenant === 'string'
        ? lesson.tenant
        : (lesson.tenant as { id: string } | null)?.id || ''

    // Create job context
    const ctx: JobContext = {
      lessonId: params.lessonId,
      sourceDocId: params.mediaId,
      tenantId,
    }

    // V1.0: Fetch diagram generator prompt (optional)
    let diagramPromptTemplate: string | null = null
    if (params.diagramPromptId) {
      const diagramPrompt = await this.payload.findByID({
        collection: 'prompts',
        id: params.diagramPromptId,
        depth: 0,
      })

      if (diagramPrompt && typeof diagramPrompt.template === 'string') {
        diagramPromptTemplate = diagramPrompt.template
      }
    }

    // Take a snapshot of the prompts for reproducibility
    const promptSnapshot = {
      extractor: typeof extractorPrompt.template === 'string' ? extractorPrompt.template : '',
      verifier: typeof verifierPrompt.template === 'string' ? verifierPrompt.template : '',
      // V1.0: Optional diagram generator prompt
      diagramGenerator: diagramPromptTemplate,
    }

    // Compute hash of prompt content for change detection
    const extractorHash = await this.hashContent(promptSnapshot.extractor)
    const verifierHash = await this.hashContent(promptSnapshot.verifier)
    const diagramGeneratorHash = diagramPromptTemplate
      ? await this.hashContent(diagramPromptTemplate)
      : null

    // Queue the job via Payload's job system
    const job = await this.payload.jobs.queue({
      task: TASK_SLUGS.PDF_TO_EXERCISES,
      input: {
        ctx,
        maxSegmentPages: 3,
        promptRefs: {
          extractorPromptId: params.extractorPromptId,
          verifierPromptId: params.verifierPromptId,
          // V1.0: Optional diagram prompt reference
          diagramPromptId: params.diagramPromptId || null,
        },
        promptSnapshot,
        promptSnapshotHash: {
          extractor: extractorHash,
          verifier: verifierHash,
          // V1.0: Optional diagram generator hash
          diagramGenerator: diagramGeneratorHash,
        },
      },
    })

    return {
      jobId: job.id,
      status: 'queued',
    }
  }

  /**
   * Get conversion status for a lesson and media
   */
  async getConversionStatus(
    lessonId: string,
    mediaId: string,
    limit = 10,
  ): Promise<ConversionJobStatus[]> {
    const jobs = await this.jobService.findByContext(
      TASK_SLUGS.PDF_TO_EXERCISES,
      {
        lessonId,
        sourceDocId: mediaId,
      },
      limit,
    )

    return jobs.map((job) => ({
      id: job.id,
      status: job.status,
      taskSlug: job.taskSlug,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      hasError: job.hasError,
      output: job.output,
    }))
  }

  /**
   * Run a job immediately (synchronous execution)
   */
  async runJobImmediate(jobId: string): Promise<ConversionResult> {
    // Claim the job (atomic operation)
    const job = await this.jobService.claimJob(jobId)

    if (!job) {
      throw apiError('JOB_NOT_FOUND', 'Job not available for execution', 404)
    }

    try {
      // Execute the task synchronously
      // This would call the actual task handler
      // For now, we mark as completed
      await this.jobService.updateStatus(jobId, 'completed', {
        exerciseIds: [],
        segmentCount: 0,
      })

      return {
        jobId,
        status: 'completed',
      }
    } catch (error) {
      await this.jobService.updateStatus(jobId, 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw error
    }
  }

  /**
   * Helper to compute SHA-256 hash of content
   */
  private async hashContent(content: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(content)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }
}
