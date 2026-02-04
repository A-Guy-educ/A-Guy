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
  // v2 interactive stages
  | 'PDF_PREVIEW'
  | 'CONFIGURATION'
  | 'SEGMENT_QUEUE'
  | 'SEGMENT_REVIEW'
  | 'ROUND_PROCESSING'
  | 'VERIFICATION_REVIEW'
  | 'FINAL_APPROVAL'
  | 'PAUSED'

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

// v2: Additional round configuration
export interface ExtractionRound {
  id: string
  name: string
  promptId: string
  targetField: string
  triggerCondition: 'always' | 'has_image' | 'has_table' | 'has_diagram' | 'custom'
  customCondition?: string
  order: number
  isEnabled: boolean
  // Runtime state
  promptSnapshot?: {
    template: string
    hash: string
  }
}

// v2: Page range configuration
export interface PageRange {
  start: number
  end?: number
  excludePages: number[]
}

// v2: Segmentation configuration
export interface SegmentationConfig {
  pagesPerSegment: number
  customBoundaries?: Array<{ start: number; end: number }>
}

// v2: Extraction configuration
export interface ExtractionConfig {
  mode: 'structured' | 'flexible'
  exerciseTypes: string[]
  customInstructions?: string
}

// v2: Review mode options
export type ReviewMode = 'auto' | 'segment' | 'batch' | 'manual'

// v2: Extended job input for v2
export interface PdfToExercisesInputV2 {
  ctx: JobContext
  pageRange: PageRange
  segmentation: SegmentationConfig
  extraction: ExtractionConfig
  reviewMode: ReviewMode
  additionalRounds: ExtractionRound[]
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

// v2: Segment status
export type SegmentStatus =
  | 'pending'
  | 'processing'
  | 'extracted'
  | 'review'
  | 'verified'
  | 'completed'
  | 'failed'
  | 'skipped'

// v2: Segment data
export interface SegmentData {
  index: number
  pageStart: number
  pageEnd: number
  status: SegmentStatus
  exerciseCount: number
  errorMessage?: string
  processedAt?: string
}

// v2: Pending exercise status
export type PendingExerciseStatus = 'pending' | 'approved' | 'rejected' | 'edited' | 'skipped'

// v2: Pending exercise in review queue
export interface PendingExercise {
  id: string
  segmentIndex: number
  orderInSegment: number
  title: string
  content: Record<string, unknown>
  enrichments: Record<string, Record<string, unknown>>
  status: PendingExerciseStatus
  verificationResult?: {
    passed: boolean
    message: string
    issues?: string[]
  }
  scores: {
    confidence: number
    completeness: number
    complexity: number
    duplicateLikelihood: number
  }
  adminNotes?: string
  savedExerciseId?: string
}

// v2: Extended output for v2
export interface PdfToExercisesOutputV2 {
  exerciseIds: string[]
  segmentCount: number
  errors?: string[]
  // v2-specific
  segmentsTotal: number
  segmentsDone: number
  segmentsFailed: number
  currentSegmentIndex: number
  exercisesDeduped: number
  exercisesSkipped: number
  exercisesApproved: number
  exercisesRejected: number
  segments: SegmentResult[]
  pendingExercises: PendingExercise[]
  roundsCompleted: number
  roundsTotal: number
  currentRoundIndex?: number
  currentRoundName?: string
  logs: JobLogEntry[]
  currentStage: JobStage
  currentStageMessage: string
}

// v2: Conversion job status (state layer)
export type ConversionJobStatus =
  | 'draft'
  | 'queued'
  | 'running'
  | 'paused'
  | 'review'
  | 'completed'
  | 'failed'
  | 'cancelled'

// v2: Progress tracking
export interface ConversionProgress {
  totalPages: number
  processedPages: number
  totalSegments: number
  completedSegments: number
  failedSegments: number
  totalExercises: number
  approvedExercises: number
  rejectedExercises: number
  skippedExercises: number
  dedupedExercises: number
}

// v2: Enrichment result schema
export interface EnrichmentResult {
  roundId: string
  roundName: string
  extractedAt: string
  promptHash: string
  data: Record<string, unknown>
}

// v2: Verification result
export interface VerificationResult {
  passed: boolean
  message: string
  issues?: string[]
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
