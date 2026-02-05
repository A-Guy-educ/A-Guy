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

// Task-specific input types (Phase 3.2)
export interface PdfToExercisesInput {
  ctx: JobContext
  maxSegmentPages: number
  promptRefs: {
    extractorPromptId: string
    verifierPromptId: string
    // V1.0: Optional diagram generator prompt reference
    diagramPromptId: string | null
  }
  promptSnapshot: {
    extractor: string
    verifier: string
    // V1.0: Optional diagram generator prompt template
    diagramGenerator: string | null
  }
  promptSnapshotHash: {
    extractor: string
    verifier: string
    // V1.0: Optional diagram generator hash
    diagramGenerator: string | null
  }
}

// Task-specific output types (Phase 3.2)
export interface DiagramPassMetrics {
  detected: number
  attempted: number
  succeeded: number
  failed: number
  skipped: number
  latencyMs: number
}

export interface PdfToExercisesOutput {
  exerciseIds: string[]
  segmentCount: number
  errors?: string[]
  // Diagram pass metrics (V1.0)
  diagramsDetected: number
  diagramPassAttempted: number
  diagramPassSucceeded: number
  diagramPassFailed: number
  diagramPassSkipped: number
  diagramPassLatencyMsTotal: number
  segments: Array<{
    pageStart: number
    pageEnd: number
    exerciseCount: number
    debug?: {
      proposedIdempotencyKeys: string[]
      diagramPass?: DiagramPassMetrics
    }
  }>
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
