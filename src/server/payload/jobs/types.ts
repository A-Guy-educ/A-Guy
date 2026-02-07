import type { ObjectId } from 'mongodb'

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface JobContext {
  lessonId: string
  sourceDocId: string
  tenantId: string
}

export interface JobDocument {
  _id: ObjectId
  id: string
  taskSlug: string
  processing: boolean
  hasError: boolean
  completedAt?: Date
  startedAt?: Date
  lockExpiresAt?: Date
  createdAt: Date
  input: {
    ctx: JobContext
    [key: string]: unknown
  }
  output?: unknown
}

export interface JobWithStatus extends JobDocument {
  status: JobStatus
}

// Task-specific input types
export interface PdfToExercisesInput {
  ctx: JobContext
  maxSegmentPages: number
  promptRefs: {
    extractorPromptId: string
    verifierPromptId: string
  }
  promptSnapshot: {
    extractor: string
    verifier: string
  }
  promptSnapshotHash: {
    extractor: string
    verifier: string
  }
}

// Task-specific output types
export interface PdfToExercisesOutput {
  exerciseIds: string[]
  segmentCount: number
  errors?: string[]
  segments: Array<{
    pageStart: number
    pageEnd: number
    exerciseCount: number
    debug?: {
      proposedIdempotencyKeys: string[]
    }
  }>
}

// Generic typed job - for type assertions in handlers
// Use 'unknown' as input type to avoid generic constraint issues
export type TypedJob<TOutput = unknown> = Omit<JobDocument, 'input' | 'output'> & {
  input: {
    ctx: JobContext
    [key: string]: unknown
  }
  output?: TOutput
}

export type PdfToExercisesJob = TypedJob<PdfToExercisesOutput>
