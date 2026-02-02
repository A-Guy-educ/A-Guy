# Detailed Plan: PDF Conversion System Improvements

## Overview

Improve the PDF-to-exercises conversion system with:

1. **Dedicated Conversion Dashboard** - Standalone admin view for job management
2. **Real-Time Streaming Logs** - SSE-based live updates replacing 10s polling
3. **Structured Job Logging** - Granular progress tracking stored in MongoDB
4. **Simplified Lesson Page** - Compact UI linking to dashboard

---

## Core Principles

1. **TDD Approach** - Write tests first for each feature
2. **Backwards Compatible** - Existing job handler continues working during migration
3. **Minimal Coupling** - Dashboard can work independently of lesson page
4. **Observable** - Every stage of conversion is logged and visible

---

## Phase 1: Backend Infrastructure - Structured Logging

### Step 1.1: Create Job Types

**New File**: `src/server/payload/jobs/types.ts`

```typescript
export interface JobLogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error'
  stage: JobStage
  message: string
  details?: Record<string, unknown>
}

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

export interface JobOutputExtended {
  // Existing fields
  segmentsTotal: number
  segmentsDone: number
  segmentsFailed: number
  currentSegmentIndex: number
  exercisesCreated: number
  exercisesDeduped: number
  exercisesSkipped: number
  errors: JobError[]
  segments: SegmentResult[]
  // New fields for streaming
  logs: JobLogEntry[]
  currentStage: JobStage
  currentStageMessage: string
}
```

### Step 1.2: Create Job Logger Utility

**New File**: `src/server/payload/jobs/job-logger.ts`

```typescript
export class JobLogger {
  private jobId: string
  private coll: Collection

  constructor(jobId: string, mongoCollection: Collection)

  async log(level: LogLevel, stage: JobStage, message: string, details?: object): Promise<void>
  // Atomic $push to jobOutput.logs + $set currentStage/currentStageMessage

  info(stage: JobStage, message: string, details?: object): Promise<void>
  warn(stage: JobStage, message: string, details?: object): Promise<void>
  error(stage: JobStage, message: string, details?: object): Promise<void>
}
```

### Step 1.3: Unit Tests for Job Logger

**New File**: `tests/unit/server/jobs/job-logger.spec.ts`

- [ ] `it('should append log entry to jobOutput.logs array')`
- [ ] `it('should update currentStage and currentStageMessage')`
- [ ] `it('should handle concurrent log calls without race conditions')`
- [ ] `it('should include timestamp in ISO format')`
- [ ] `it('should handle details object serialization')`

---

## Phase 2: SSE Streaming Endpoint

### Step 2.1: Create SSE Stream Route

**New File**: `src/app/api/jobs/[jobId]/stream/route.ts`

```typescript
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } },
): Promise<Response>
// Returns ReadableStream with text/event-stream
// Events: log, status, done, error
// Polls MongoDB every 500ms for new logs
// Auto-closes when job completes
```

### Step 2.2: Integration Tests for SSE Endpoint

**New File**: `tests/int/jobs-stream.int.spec.ts`

- [ ] `describe('GET /api/jobs/[jobId]/stream')`
  - [ ] `it('should return 401 for unauthenticated requests')`
  - [ ] `it('should return 401 for non-admin users')`
  - [ ] `it('should return 404 for non-existent job')`
  - [ ] `it('should stream log events as they are added')`
  - [ ] `it('should stream status updates with segment progress')`
  - [ ] `it('should send done event when job completes')`
  - [ ] `it('should send done event when job fails')`
  - [ ] `it('should close stream after done event')`
  - [ ] `it('should handle concurrent SSE connections to same job')`

### Step 2.3: Test Helper for SSE

**New File**: `tests/helpers/sse-client.ts`

```typescript
export async function collectSSEEvents(
  url: string,
  headers: HeadersInit,
  options?: { timeout?: number; maxEvents?: number },
): Promise<{ events: SSEEvent[]; closed: boolean }>
```

---

## Phase 3: Additional Job Management APIs

### Step 3.1: Jobs List Endpoint

**New File**: `src/app/api/jobs/list/route.ts`

```typescript
export async function GET(request: NextRequest): Promise<NextResponse>
// Query params: page, limit, status, lessonId, dateFrom, dateTo
// Returns: { docs, totalDocs, totalPages, page }
```

### Step 3.2: Job Cancel Endpoint

**New File**: `src/app/api/jobs/cancel/route.ts`

```typescript
export async function POST(request: NextRequest): Promise<NextResponse>
// Body: { jobId }
// Only cancels queued jobs (not running or completed)
// Sets hasError=true, completedAt, jobOutput.cancelled=true
```

### Step 3.3: Job Retry Endpoint

**New File**: `src/app/api/jobs/retry/route.ts`

```typescript
export async function POST(request: NextRequest): Promise<NextResponse>
// Body: { jobId }
// Creates new job with same input as original
// Returns: { success, newJobId }
```

### Step 3.4: Jobs Count Endpoint

**New File**: `src/app/api/jobs/count/route.ts`

```typescript
export async function GET(request: NextRequest): Promise<NextResponse>
// Query params: lessonId, status (comma-separated)
// Returns: { count }
```

### Step 3.5: Integration Tests for Job APIs

**New File**: `tests/int/jobs-api.int.spec.ts`

- [ ] `describe('GET /api/jobs/list')`
  - [ ] `it('should return 401 for unauthenticated requests')`
  - [ ] `it('should return paginated list of jobs')`
  - [ ] `it('should filter by status (queued, running, completed, failed)')`
  - [ ] `it('should filter by lessonId')`
  - [ ] `it('should sort by createdAt descending')`
  - [ ] `it('should compute status from processing/hasError/completedAt')`

- [ ] `describe('POST /api/jobs/cancel')`
  - [ ] `it('should return 401 for unauthenticated requests')`
  - [ ] `it('should return 404 for non-existent job')`
  - [ ] `it('should cancel queued job successfully')`
  - [ ] `it('should reject cancellation of running job')`
  - [ ] `it('should reject cancellation of completed job')`
  - [ ] `it('should add cancelled log entry to jobOutput.logs')`

- [ ] `describe('POST /api/jobs/retry')`
  - [ ] `it('should return 401 for unauthenticated requests')`
  - [ ] `it('should return 404 for non-existent job')`
  - [ ] `it('should create new job with same input')`
  - [ ] `it('should return new job ID')`
  - [ ] `it('should work for both failed and completed jobs')`

- [ ] `describe('GET /api/jobs/count')`
  - [ ] `it('should return count of jobs matching filters')`
  - [ ] `it('should support comma-separated status filter')`

---

## Phase 4: Update Job Handler with Structured Logging

### Step 4.1: Modify Job Handler

**Modify File**: `src/server/payload/jobs/pdf-to-exercises-task.ts`

- [ ] Import `JobLogger` from `./job-logger`
- [ ] Initialize logger at handler start: `const jobLogger = new JobLogger(job.id, coll)`
- [ ] Replace `console.log/error` calls with `jobLogger.info/warn/error`
- [ ] Add logging at each stage:
  - `INIT`: "Starting PDF to exercises conversion"
  - `PDF_LOAD`: "Loading PDF from blob storage", details: { url, size }
  - `PDF_SEGMENT`: "Segmented PDF", details: { totalPages, segmentCount }
  - `SEGMENT_EXTRACT`: "Processing segment", details: { index, pageStart, pageEnd }
  - `SEGMENT_VERIFY`: "Verifying exercises", details: { count }
  - `SEGMENT_PERSIST`: "Saved exercises", details: { created, deduped, skipped }
  - `COMPLETE`: "Conversion completed successfully", details: { totalExercises }
  - `FAILED`: "Conversion failed", details: { error, stage }

### Step 4.2: Integration Tests for Updated Handler

**Modify File**: `tests/int/jobs-run-now.int.spec.ts`

- [ ] `it('should populate jobOutput.logs during execution')`
- [ ] `it('should update currentStage as job progresses')`
- [ ] `it('should include segment details in log entries')`
- [ ] `it('should log errors with full context on failure')`

---

## Phase 5: Admin Dashboard Components

### Step 5.1: Create Dashboard View

**New File**: `src/ui/admin/ConversionDashboard/index.tsx`

```typescript
export function ConversionDashboard(): JSX.Element
// Main dashboard with:
// - Header with title and description
// - JobFilters component
// - JobListTable component
// - JobDetailPanel (when job selected)
```

### Step 5.2: Create Job List Table

**New File**: `src/ui/admin/ConversionDashboard/JobListTable.tsx`

```typescript
interface JobListTableProps {
  jobs: Job[]
  isLoading: boolean
  selectedJobId?: string
  onSelectJob: (job: Job) => void
  onRetryJob: (jobId: string) => void
  onCancelJob: (jobId: string) => void
}
```

- [ ] Columns: Status, Lesson, Progress, Created, Completed, Actions
- [ ] Row click selects job
- [ ] Retry/Cancel buttons in actions column
- [ ] Status badge with color coding

### Step 5.3: Create Job Detail Panel

**New File**: `src/ui/admin/ConversionDashboard/JobDetailPanel.tsx`

```typescript
interface JobDetailPanelProps {
  job: Job
  onClose: () => void
  onRefresh: () => void
}
```

- [ ] SSE connection for running/queued jobs
- [ ] Displays: Job ID, Status, Lesson link, Created/Completed times
- [ ] ProgressTimeline component
- [ ] LogViewer component
- [ ] Action buttons: Run Now, Retry, Cancel (based on status)

### Step 5.4: Create Progress Timeline

**New File**: `src/ui/admin/ConversionDashboard/ProgressTimeline.tsx`

```typescript
interface ProgressTimelineProps {
  currentStage?: JobStage
  segmentsDone: number
  segmentsTotal: number
  exercisesCreated: number
}
```

- [ ] Visual stepper with stages: Init → Load → Segment → Extract → Verify → Persist → Complete
- [ ] Current stage highlighted with animation
- [ ] Progress bar for segment completion
- [ ] Exercise count display

### Step 5.5: Create Log Viewer

**New File**: `src/ui/admin/ConversionDashboard/LogViewer.tsx`

```typescript
interface LogViewerProps {
  logs: JobLogEntry[]
  status: string
}
```

- [ ] Text search filter
- [ ] Level filter (all, info, warn, error)
- [ ] Auto-scroll toggle
- [ ] Expandable details for each log entry
- [ ] Color coding by level
- [ ] Timestamp formatting

### Step 5.6: Create Job Filters

**New File**: `src/ui/admin/ConversionDashboard/JobFilters.tsx`

```typescript
interface JobFiltersProps {
  filters: Filters
  onChange: (filters: Filters) => void
}
```

- [ ] Status dropdown (All, Queued, Running, Completed, Failed)
- [ ] Lesson search/autocomplete
- [ ] Date range picker
- [ ] Clear filters button

### Step 5.7: Create Styles

**New File**: `src/ui/admin/ConversionDashboard/styles.css`

- [ ] Dashboard layout (2-column: list + detail)
- [ ] Job table styling
- [ ] Status badges
- [ ] Progress timeline
- [ ] Log viewer styling
- [ ] Responsive breakpoints

### Step 5.8: Register Dashboard in Payload Config

**Modify File**: `src/payload.config.ts`

- [ ] Add custom view at path `/conversion-jobs`
- [ ] Component: `@/ui/admin/ConversionDashboard`

### Step 5.9: Create Navigation Link

**New File**: `src/ui/admin/ConversionNavLink/index.tsx`

- [ ] Link to `/admin/conversion-jobs`
- [ ] Under "Tools" group in admin nav

**Modify File**: `src/payload.config.ts`

- [ ] Add to `admin.components.afterNavLinks`

---

## Phase 6: Simplify Lesson Page

### Step 6.1: Refactor LessonConversionPanel

**Modify File**: `src/ui/admin/exercise-conversion/LessonConversionPanel/index.tsx`

- [ ] Remove `ConversionStatusPanel` and `DraftExercisesList` inline display
- [ ] Add badge showing active job count for this lesson
- [ ] Add "View All Jobs" link to `/admin/conversion-jobs?lessonId={id}`
- [ ] Keep PDF list with "Convert" button
- [ ] Keep `ConvertModal` for starting new conversions
- [ ] Show minimal status indicator (spinner if jobs running)

### Step 6.2: E2E Tests for Dashboard

**New File**: `tests/e2e/conversion-dashboard.e2e.spec.ts`

- [ ] `describe('Conversion Dashboard')`
  - [ ] `it('should load dashboard page for admin user')`
  - [ ] `it('should display list of conversion jobs')`
  - [ ] `it('should filter jobs by status')`
  - [ ] `it('should show job details when row clicked')`
  - [ ] `it('should stream logs in real-time for running job')`
  - [ ] `it('should navigate to dashboard from lesson page')`

---

## Files Summary

### New Files

| File                                                    | Purpose                      |
| ------------------------------------------------------- | ---------------------------- |
| `src/server/payload/jobs/types.ts`                      | Job log types and interfaces |
| `src/server/payload/jobs/job-logger.ts`                 | Structured logging utility   |
| `src/app/api/jobs/[jobId]/stream/route.ts`              | SSE streaming endpoint       |
| `src/app/api/jobs/list/route.ts`                        | Paginated job list           |
| `src/app/api/jobs/cancel/route.ts`                      | Cancel queued jobs           |
| `src/app/api/jobs/retry/route.ts`                       | Retry failed jobs            |
| `src/app/api/jobs/count/route.ts`                       | Count jobs by filter         |
| `src/ui/admin/ConversionDashboard/index.tsx`            | Main dashboard view          |
| `src/ui/admin/ConversionDashboard/JobListTable.tsx`     | Job list table               |
| `src/ui/admin/ConversionDashboard/JobDetailPanel.tsx`   | Job detail with SSE          |
| `src/ui/admin/ConversionDashboard/ProgressTimeline.tsx` | Visual progress stepper      |
| `src/ui/admin/ConversionDashboard/LogViewer.tsx`        | Searchable log viewer        |
| `src/ui/admin/ConversionDashboard/JobFilters.tsx`       | Filter controls              |
| `src/ui/admin/ConversionDashboard/styles.css`           | Dashboard styles             |
| `src/ui/admin/ConversionNavLink/index.tsx`              | Admin nav link               |
| `tests/unit/server/jobs/job-logger.spec.ts`             | Unit tests for logger        |
| `tests/int/jobs-stream.int.spec.ts`                     | SSE endpoint tests           |
| `tests/int/jobs-api.int.spec.ts`                        | Job API tests                |
| `tests/helpers/sse-client.ts`                           | SSE test helper              |
| `tests/e2e/conversion-dashboard.e2e.spec.ts`            | E2E tests                    |

### Modified Files

| File                                                               | Changes                         |
| ------------------------------------------------------------------ | ------------------------------- |
| `src/server/payload/jobs/pdf-to-exercises-task.ts`                 | Add structured logging          |
| `src/ui/admin/exercise-conversion/LessonConversionPanel/index.tsx` | Simplify to compact version     |
| `src/payload.config.ts`                                            | Register custom view + nav link |
| `tests/int/jobs-run-now.int.spec.ts`                               | Add logging assertions          |

---

## Test Coverage Matrix

| Requirement        | Unit Tests           | Integration Tests          | E2E Tests                          |
| ------------------ | -------------------- | -------------------------- | ---------------------------------- |
| Structured logging | `job-logger.spec.ts` | `jobs-run-now.int.spec.ts` | -                                  |
| SSE streaming      | -                    | `jobs-stream.int.spec.ts`  | `conversion-dashboard.e2e.spec.ts` |
| Job list API       | -                    | `jobs-api.int.spec.ts`     | -                                  |
| Job cancel API     | -                    | `jobs-api.int.spec.ts`     | -                                  |
| Job retry API      | -                    | `jobs-api.int.spec.ts`     | -                                  |
| Job count API      | -                    | `jobs-api.int.spec.ts`     | -                                  |
| Dashboard UI       | -                    | -                          | `conversion-dashboard.e2e.spec.ts` |
| Lesson page link   | -                    | -                          | `conversion-dashboard.e2e.spec.ts` |

---

## Acceptance Criteria

### Phase 1 (Types + Logger)

- [ ] `JobLogEntry` and `JobStage` types exported
- [ ] `JobLogger` class appends logs atomically to MongoDB
- [ ] Unit tests pass for logger

### Phase 2 (SSE)

- [ ] SSE endpoint streams logs in real-time
- [ ] SSE endpoint requires admin auth
- [ ] SSE auto-closes on job completion
- [ ] Integration tests pass

### Phase 3 (APIs)

- [ ] List endpoint returns paginated, filtered jobs
- [ ] Cancel endpoint marks queued jobs as cancelled
- [ ] Retry endpoint creates new job with same input
- [ ] Count endpoint returns matching job count
- [ ] All endpoints require admin auth
- [ ] Integration tests pass

### Phase 4 (Handler Update)

- [ ] Job handler logs at each stage
- [ ] Logs include relevant details (segment info, counts)
- [ ] Existing job functionality unchanged
- [ ] Integration tests pass

### Phase 5 (Dashboard)

- [ ] Dashboard accessible at `/admin/conversion-jobs`
- [ ] Job list displays with filtering
- [ ] Job detail shows SSE-streamed logs
- [ ] Progress timeline visualizes stages
- [ ] Retry/Cancel buttons work
- [ ] E2E tests pass

### Phase 6 (Lesson Page)

- [ ] Lesson page shows compact conversion panel
- [ ] Active job count badge visible
- [ ] Link to dashboard works
- [ ] E2E tests pass

---

## Implementation Order (TDD)

1. **Write tests first** for each phase before implementation
2. **Phase 1**: Unit tests → Types → Logger → Run tests
3. **Phase 2**: Integration tests → SSE endpoint → Run tests
4. **Phase 3**: Integration tests → APIs → Run tests
5. **Phase 4**: Update existing tests → Modify handler → Run tests
6. **Phase 5**: E2E tests → Dashboard components → Run tests
7. **Phase 6**: E2E tests → Lesson page changes → Run tests
8. **Final**: Run `pnpm ci:local` to verify all quality gates

---

## Non-Goals

- No WebSocket implementation (SSE is simpler for unidirectional streaming)
- No external job queue (continue using Payload's built-in system)
- No job scheduling UI (jobs are triggered manually or via cron)
- No job dependencies/chaining
- No notification system (toast messages are client-side only)
