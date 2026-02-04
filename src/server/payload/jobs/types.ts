import type { ObjectId } from 'mongodb'

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed'

export type LogLevel = 'info' | 'warn' | 'error'

export type JobStage =
  | 'INIT'
  | 'PDF_LOAD'
  | 'PDF_SEGMENT'
  | 'SEGMENT_EXTRACT'
  | 'SEGMENT_VERIFY'
  | 'SEGMENT_PERSIST'
  | 'COMPLETE'
  | 'FAILED'
  | 'CANCELLED'

export interface JobLogEntry {
  timestamp: string
  level: LogLevel
  stage: JobStage
  message: string
  details?: Record<string, unknown>
}

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

// Task-specific input types (Phase 3.2)
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

// Task-specific output types (Phase 3.2)
export interface PdfToExercisesOutput {
  exerciseIds: string[]
  segmentCount: number
  errors?: string[]
}

// Generic typed job (Phase 3.2) - for type assertions in handlers
// Use 'unknown' as input type to avoid generic constraint issues
export type TypedJob<TOutput = unknown> = Omit<JobDocument, 'input' | 'output'> & {
  input: {
    ctx: JobContext
    [key: string]: unknown
  }
  output?: TOutput
}

export type PdfToExercisesJob = TypedJob<PdfToExercisesOutput>

export interface SegmentResult {
  index: number
  pageStart: number
  pageEnd: number
  exercisesCreated: number
  exercisesDeduped: number
  exercisesSkipped: number
  error?: string
}

// Extended output for PDF conversion with streaming support
export interface PdfToExercisesOutputExtended extends PdfToExercisesOutput {
  segmentsTotal: number
  segmentsDone: number
  segmentsFailed: number
  currentSegmentIndex: number
  exercisesDeduped: number
  exercisesSkipped: number
  segments: SegmentResult[]
  logs: JobLogEntry[]
  currentStage: JobStage
  currentStageMessage: string
}
