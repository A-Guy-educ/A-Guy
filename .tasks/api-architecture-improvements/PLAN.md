# Architecture Improvement Plan

**Complete 9-Phase Implementation across 3 Priorities**

Each phase is self-contained and delivers immediate value.

---

# Priority 1: Critical (High Impact)

## Phase 0: Quick Audit (Pre-flight Check)

**Goal**: Verify current state before refactoring

### Tasks

- [ ] Audit existing routes for response formats (16+ routes)
- [ ] Confirm `computeJobStatus` exists in `queries.ts`
- [ ] Document current error patterns to validate refactor scope
- [ ] Snapshot current test coverage for job routes

---

## Phase 1.1: Unified API Response Layer

**Goal**: Standardize all API error/success responses across 16+ routes

### Create Response Utilities

**New file**: `src/server/api/responses.ts`

```typescript
import { NextResponse } from 'next/server'
import type { ZodError } from 'zod'
import { formatZodErrors } from '@/infra/utils/validation'

// Standardized error codes (extensible)
export type ApiErrorCode =
  // Auth errors
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  // Validation errors
  | 'VALIDATION_ERROR'
  | 'MISSING_REQUIRED_FIELD'
  // Resource errors
  | 'NOT_FOUND'
  | 'LESSON_NOT_FOUND'
  | 'PROMPT_NOT_FOUND'
  | 'MEDIA_NOT_ATTACHED'
  // Job errors
  | 'JOB_NOT_FOUND'
  | 'JOB_ALREADY_RUNNING'
  | 'JOB_ALREADY_COMPLETED'
  // System errors
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode
    message: string
    details?: Record<string, string[]>
  }
}

export interface ApiSuccessResponse<T = unknown> {
  success: true
  data?: T
  message?: string
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: Record<string, string[]>,
): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ error: { code, message, ...(details && { details }) } }, { status })
}

export function apiSuccess<T>(
  data?: T,
  message?: string,
  status = 200,
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    { success: true, ...(data !== undefined && { data }), ...(message && { message }) },
    { status },
  )
}

export function apiValidationError(error: ZodError): NextResponse<ApiErrorResponse> {
  return apiError('VALIDATION_ERROR', 'Validation failed', 400, formatZodErrors(error))
}

export const ApiErrors = {
  unauthorized: (message = 'Authentication required') => apiError('UNAUTHORIZED', message, 401),
  forbidden: (message = 'Access denied') => apiError('FORBIDDEN', message, 403),
  notFound: (resource: string) => apiError('NOT_FOUND', `${resource} not found`, 404),
  internal: (message = 'Internal server error') => apiError('INTERNAL_ERROR', message, 500),
} as const
```

### Files to Refactor

| File                                                                                    | Current Pattern     | Change                           |
| --------------------------------------------------------------------------------------- | ------------------- | -------------------------------- |
| [run-immediate/route.ts](../../src/app/api/jobs/run-immediate/route.ts)                 | `{ error: string }` | Use `apiError()`, `apiSuccess()` |
| [status/route.ts](../../src/app/api/exercises/convert/status/route.ts)                  | `{ error: string }` | Use `apiError()`, `apiSuccess()` |
| [runner/route.ts](../../src/app/api/exercises/convert/runner/route.ts)                  | `{ error/success }` | Use `apiError()`, `apiSuccess()` |
| [queue-conversion.ts](../../src/server/payload/endpoints/exercises/queue-conversion.ts) | `Response.json()`   | Use `apiError()`                 |

### Deliverables

- [ ] Create `src/server/api/responses.ts`
- [ ] Create `src/server/api/index.ts` (barrel export)
- [ ] Refactor 5 job-related routes
- [ ] Add tests for response utilities

---

## Phase 1.2: JobService Abstraction

**Goal**: Centralize all job operations into a single service

### Create Job Types

**New file**: `src/server/payload/jobs/types.ts`

```typescript
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
```

### Create JobService (Lazy Singleton Pattern)

**New file**: `src/server/payload/services/job-service.ts`

```typescript
import type { SanitizedConfig } from 'payload'
import { ObjectId, type Collection, type Document } from 'mongodb'
import { LOCK_TIMEOUT_MS } from '@/server/config/constants'
import type { JobDocument, JobStatus, JobContext, JobWithStatus } from '../jobs/types'
import { JOBS_COLLECTION } from '../jobs/constants'

let cachedService: JobService | null = null
let cachedCollection: Collection<Document> | null = null

export class JobService {
  private constructor(private readonly collection: Collection<Document>) {}

  static getInstance(config: SanitizedConfig | Promise<SanitizedConfig>): JobService {
    if (cachedService) return cachedService

    const resolvedConfig = config instanceof Promise ? config : Promise.resolve(config)
    resolvedConfig.then((cfg) => {
      const db = (cfg as { db?: { connection?: { collection: (name: string) => Collection } } }).db
      cachedCollection = db?.connection?.collection?.(JOBS_COLLECTION) || null
    })

    cachedService = new JobService(cachedCollection!)
    return cachedService
  }

  computeStatus(doc: JobDocument): JobStatus {
    if (doc.processing) return 'running'
    if (doc.hasError) return 'failed'
    if (doc.completedAt) return 'completed'
    return 'queued'
  }

  async claimJob(jobId: string): Promise<JobDocument | null> {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + LOCK_TIMEOUT_MS)

    const result = await this.collection.findOneAndUpdate(
      {
        _id: new ObjectId(jobId),
        processing: { $ne: true },
        hasError: { $ne: true },
        $or: [{ lockExpiresAt: { $exists: false } }, { lockExpiresAt: { $lt: now } }],
      },
      { $set: { processing: true, startedAt: now, lockExpiresAt: expiresAt } },
      { returnDocument: 'after' },
    )
    return result as JobDocument | null
  }

  async updateStatus(
    jobId: string,
    status: 'completed' | 'failed',
    output?: unknown,
  ): Promise<void> {
    const update: Record<string, unknown> = {
      processing: false,
      completedAt: new Date(),
      hasError: status === 'failed',
    }
    if (output !== undefined) update.output = output
    await this.collection.updateOne({ _id: new ObjectId(jobId) }, { $set: update })
  }

  async extendLock(jobId: string): Promise<void> {
    const expiresAt = new Date(Date.now() + LOCK_TIMEOUT_MS)
    await this.collection.updateOne(
      { _id: new ObjectId(jobId) },
      { $set: { lockExpiresAt: expiresAt } },
    )
  }

  async findByContext(
    taskSlug: string,
    ctx: Partial<JobContext>,
    limit = 10,
  ): Promise<JobWithStatus[]> {
    const query: Record<string, unknown> = { taskSlug }
    if (ctx.lessonId) query['input.ctx.lessonId'] = ctx.lessonId
    if (ctx.sourceDocId) query['input.ctx.sourceDocId'] = ctx.sourceDocId
    if (ctx.tenantId) query['input.ctx.tenantId'] = ctx.tenantId

    const docs = await this.collection.find(query).sort({ createdAt: -1 }).limit(limit).toArray()
    return docs.map((doc) => ({
      ...doc,
      id: doc._id.toString(),
      status: this.computeStatus(doc as unknown as JobDocument),
    })) as JobWithStatus[]
  }

  async getById(jobId: string): Promise<JobWithStatus | null> {
    const doc = await this.collection.findOne({ _id: new ObjectId(jobId) })
    if (!doc) return null
    return {
      ...doc,
      id: doc._id.toString(),
      status: this.computeStatus(doc as unknown as JobDocument),
    } as JobWithStatus
  }
}
```

### Deliverables

- [ ] Create `src/server/payload/jobs/types.ts`
- [ ] Create `src/server/payload/services/job-service.ts`
- [ ] Create `src/server/payload/services/index.ts` (barrel)
- [ ] Refactor [run-immediate/route.ts](../../src/app/api/jobs/run-immediate/route.ts)
- [ ] Refactor [status/route.ts](../../src/app/api/exercises/convert/status/route.ts)
- [ ] Refactor [runner/route.ts](../../src/app/api/exercises/convert/runner/route.ts)
- [ ] Add unit tests for JobService
- [ ] Remove duplicate `computeJobStatus` from [queries.ts](../../src/server/payload/utils/queries.ts)

---

## Phase 1.3: Request Validation Layer

**Goal**: Standardize input validation with Zod schemas

### Create Job Schemas

**New file**: `src/server/api/schemas/job-schemas.ts`

```typescript
import { z } from 'zod'

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId format')

export const runJobSchema = z.object({
  jobId: objectIdSchema,
})

export const jobStatusQuerySchema = z.object({
  lessonId: objectIdSchema,
  mediaId: objectIdSchema,
  limit: z.coerce.number().int().min(1).max(100).default(1),
})

export const queueConversionSchema = z.object({
  lessonId: objectIdSchema,
  mediaId: objectIdSchema,
  extractorPromptId: objectIdSchema,
  verifierPromptId: objectIdSchema,
})

export type RunJobInput = z.infer<typeof runJobSchema>
export type JobStatusQuery = z.infer<typeof jobStatusQuerySchema>
export type QueueConversionInput = z.infer<typeof queueConversionSchema>
```

### Add Validation Helpers to responses.ts

```typescript
import { safeValidate } from '@/infra/utils/validation'
import type { ZodSchema } from 'zod'

export async function parseAndValidate<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
): Promise<{ data: T } | { error: NextResponse<ApiErrorResponse> }> {
  try {
    const body = await request.json()
    const result = safeValidate(schema, body)
    if (!result.success) return { error: apiValidationError(result.error) }
    return { data: result.data }
  } catch {
    return { error: apiError('VALIDATION_ERROR', 'Invalid JSON body', 400) }
  }
}

export function parseQueryParams<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
): { data: T } | { error: NextResponse<ApiErrorResponse> } {
  const { searchParams } = new URL(request.url)
  const params = Object.fromEntries(searchParams.entries())
  const result = safeValidate(schema, params)
  if (!result.success) return { error: apiValidationError(result.error) }
  return { data: result.data }
}
```

### Deliverables

- [ ] Create `src/server/api/schemas/job-schemas.ts`
- [ ] Create `src/server/api/schemas/index.ts` (barrel)
- [ ] Add `parseAndValidate()` and `parseQueryParams()` to responses.ts
- [ ] Refactor job routes to use schema validation
- [ ] Add tests for schemas and validation helpers

---

# Priority 2: Important (Medium Impact)

## Phase 2.1: API Route Wrapper/Middleware

**Goal**: Reduce boilerplate in route handlers with enhanced error handling

### Create Route Wrapper

**New file**: `src/server/api/with-api-handler.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { ZodSchema } from 'zod'
import type { User } from 'payload'
import {
  requireAdmin,
  requireAuthenticated,
  requireAdminOrTestSecret,
} from '@/server/payload/utils/auth'
import { parseAndValidate, parseQueryParams, apiError, ApiErrors } from './responses'
import { createApiLogger } from './logger'

export type AuthLevel = 'admin' | 'adminOrTest' | 'authenticated' | 'public'

export interface ApiContext<TBody = unknown, TQuery = unknown> {
  request: NextRequest
  payload: Awaited<ReturnType<typeof getPayload>>
  user: User | null
  body: TBody
  query: TQuery
  logger: ReturnType<typeof createApiLogger>
}

export interface HandlerOptions<TBody, TQuery> {
  auth?: AuthLevel
  bodySchema?: ZodSchema<TBody>
  querySchema?: ZodSchema<TQuery>
}

export function withApiHandler<TBody = unknown, TQuery = unknown>(
  options: HandlerOptions<TBody, TQuery>,
  handler: (ctx: ApiContext<TBody, TQuery>) => Promise<NextResponse>,
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const requestId = request.headers.get('x-request-id') || crypto.randomUUID()

    try {
      const payload = await getPayload({ config: configPromise })
      const { user } = await payload.auth({ headers: request.headers })
      const authHeader = request.headers.get('authorization')

      // Auth check
      if (options.auth === 'admin') {
        try {
          requireAdmin(user)
        } catch {
          return ApiErrors.unauthorized('Admin access required')
        }
      } else if (options.auth === 'adminOrTest') {
        try {
          requireAdminOrTestSecret(user, authHeader)
        } catch {
          return ApiErrors.unauthorized('Admin access required')
        }
      } else if (options.auth === 'authenticated') {
        try {
          requireAuthenticated(user)
        } catch {
          return ApiErrors.unauthorized()
        }
      }

      // Parse body
      let body: TBody = undefined as TBody
      if (options.bodySchema) {
        const parsed = await parseAndValidate(request, options.bodySchema)
        if ('error' in parsed) return parsed.error
        body = parsed.data
      }

      // Parse query params
      let query: TQuery = undefined as TQuery
      if (options.querySchema) {
        const parsed = parseQueryParams(request, options.querySchema)
        if ('error' in parsed) return parsed.error
        query = parsed.data
      }

      const logger = createApiLogger(request, 'api-handler')

      return await handler({ request, payload, user, body, query, logger })
    } catch (error) {
      const logger = createApiLogger(request, 'api-handler')

      // Distinguish between operational and system errors
      const isOperational =
        error instanceof Error &&
        (error.name === 'ValidationError' ||
          error.message.includes('not found') ||
          error.message.includes('already exists'))

      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          requestId,
          isOperational,
        },
        'API handler error',
      )

      if (isOperational) {
        return apiError(
          'VALIDATION_ERROR',
          error instanceof Error ? error.message : 'Operation failed',
          400,
        )
      }

      return apiError('INTERNAL_ERROR', 'Internal server error', 500)
    }
  }
}
```

### Example Usage

```typescript
// Before: 50+ lines with boilerplate
export async function POST(request: NextRequest) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  try {
    requireAdmin(user)
  } catch {
    return NextResponse.json({ error: '...' }, { status: 401 })
  }
  const { jobId } = await request.json()
  if (!jobId) return NextResponse.json({ error: '...' }, { status: 400 })
  // ... business logic
}

// After: Clean handler
export const POST = withApiHandler(
  { auth: 'admin', bodySchema: runJobSchema },
  async ({ payload, body }) => {
    const { jobId } = body
    // ... business logic only
    return apiSuccess({ jobId })
  },
)
```

### Deliverables

- [ ] Create `src/server/api/with-api-handler.ts`
- [ ] Create typed `ApiContext` interface with logger
- [ ] Add error boundary with request ID propagation
- [ ] Distinguish operational vs system errors
- [ ] Refactor 3-5 routes as proof of concept
- [ ] Document usage pattern

---

## Phase 2.2: Separate Business Logic from Routes

**Goal**: Move business logic to service layer

### Create Exercise Conversion Service

**New file**: `src/server/payload/services/exercise-conversion-service.ts`

```typescript
import type { Payload } from 'payload'
import { JobService } from './job-service'
import { TASK_SLUG } from '@/server/config/constants'

export interface QueueConversionParams {
  lessonId: string
  mediaId: string
  extractorPromptId: string
  verifierPromptId: string
}

export interface ConversionResult {
  jobId: string
  status: string
}

export class ExerciseConversionService {
  constructor(
    private readonly payload: Payload,
    private readonly jobService: JobService,
  ) {}

  async queueConversion(params: QueueConversionParams): Promise<ConversionResult> {
    // Validate lesson exists and get tenant
    const lesson = await this.payload.findByID({ collection: 'lessons', id: params.lessonId })
    if (!lesson) throw new Error('Lesson not found')

    // Validate media belongs to lesson
    // Validate prompts exist and match tenant
    // Queue job via Payload

    const job = await this.payload.jobs.queue({
      task: TASK_SLUG,
      input: {
        /* ... */
      },
    })

    return { jobId: job.id, status: 'queued' }
  }

  async getConversionStatus(lessonId: string, mediaId: string) {
    return this.jobService.findByContext(TASK_SLUG, { lessonId, sourceDocId: mediaId })
  }

  async runJobImmediate(jobId: string): Promise<ConversionResult> {
    const job = await this.jobService.claimJob(jobId)
    if (!job) throw new Error('Job not available')

    // Execute task
    // Update status

    return { jobId, status: 'completed' }
  }
}
```

### Route Becomes Thin Controller

```typescript
// src/app/api/exercises/convert/queue/route.ts
export const POST = withApiHandler(
  { auth: 'adminOrTest', bodySchema: queueConversionSchema },
  async ({ payload, body }) => {
    const jobService = JobService.getInstance(configPromise)
    const service = new ExerciseConversionService(payload, jobService)

    const result = await service.queueConversion(body)
    return apiSuccess(result, 'Conversion job queued')
  },
)
```

### Deliverables

- [ ] Create `src/server/payload/services/exercise-conversion-service.ts`
- [ ] Move validation logic from routes to service
- [ ] Move business logic from [queue-conversion.ts](../../src/server/payload/endpoints/exercises/queue-conversion.ts)
- [ ] Refactor routes to be thin controllers
- [ ] Add unit tests for service

---

## Phase 2.3: Task Registry Pattern

**Goal**: Dynamic task lookup for debugging/admin (keep static imports as primary)

### Create Task Registry

**New file**: `src/server/payload/jobs/task-registry.ts`

```typescript
import type { TaskConfig } from 'payload'

type TaskHandler = TaskConfig<string, unknown>['handler']

interface RegisteredTask {
  slug: string
  handler: TaskHandler
  description?: string
}

class TaskRegistry {
  private tasks = new Map<string, RegisteredTask>()

  register(task: RegisteredTask): void {
    this.tasks.set(task.slug, task)
  }

  get(slug: string): RegisteredTask | undefined {
    return this.tasks.get(slug)
  }

  has(slug: string): boolean {
    return this.tasks.has(slug)
  }

  list(): string[] {
    return Array.from(this.tasks.keys())
  }

  describe(slug: string): { description?: string; exists: boolean } {
    const task = this.tasks.get(slug)
    return { description: task?.description, exists: !!task }
  }
}

export const taskRegistry = new TaskRegistry()

// Auto-register tasks
export function registerTask(slug: string, handler: TaskHandler, description?: string) {
  taskRegistry.register({ slug, handler, description })
}
```

### Update Task Definition

```typescript
// src/server/payload/jobs/pdf-to-exercises-task.ts
import { registerTask } from './task-registry'
import { TASK_SLUG } from '@/server/config/constants'

export const pdfToExercisesTask = defineTask({
  slug: TASK_SLUG,
  handler: async ({ job, req }) => {
    /* ... */
  },
})

// Register for dynamic lookup (used by admin/debug endpoints)
registerTask(TASK_SLUG, pdfToExercisesTask.handler, 'Convert PDF to exercises')
```

### Update run-immediate to Use Registry (Optional/Debug)

```typescript
// Primary: Static import (unchanged)
import { pdfToExercisesTask } from '@/server/payload/jobs/pdf-to-exercises-task'
await pdfToExercisesTask.handler({ job, req })

// Debug mode: Dynamic lookup via registry
import { taskRegistry } from '@/server/payload/jobs/task-registry'

if (process.env.DEBUG_MODE === 'true') {
  const task = taskRegistry.get(job.taskSlug)
  if (!task) return apiError('NOT_FOUND', `Task ${job.taskSlug} not registered`, 404)
  await task.handler({ job, req })
}
```

### Deliverables

- [ ] Create `src/server/payload/jobs/task-registry.ts`
- [ ] Update [pdf-to-exercises-task.ts](../../src/server/payload/jobs/pdf-to-exercises-task.ts) to register
- [ ] Add admin endpoint `task-registry/list` for debugging
- [ ] Add tests for registry

---

# Priority 3: Nice to Have (Lower Impact)

## Phase 3.1: Standardize Logging

**Goal**: Replace console.log with structured Pino logging

### Create API Logger

**New file**: `src/server/api/logger.ts`

```typescript
import { createLogger } from '@/infra/utils/logger'
import type { NextRequest } from 'next/server'

export function createApiLogger(request: NextRequest, routeName: string) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()

  return createLogger().child({
    route: routeName,
    requestId,
    method: request.method,
    url: request.url,
    // OpenTelemetry trace context
    traceId: request.headers.get('x-trace-id'),
    spanId: request.headers.get('x-span-id'),
  })
}

// Singleton for non-request contexts
export const apiLogger = createLogger().child({ component: 'api' })
```

### Update Routes

```typescript
// Before
console.log(`[run-immediately] Executing job ${jobId} synchronously`)
console.error('[run-immediately] Error:', error)

// After
const logger = createApiLogger(request, 'run-immediate')
logger.info({ jobId }, 'Executing job synchronously')
logger.error({ error, jobId }, 'Job execution failed')
```

### Deliverables

- [ ] Create `src/server/api/logger.ts`
- [ ] Update job routes to use structured logging
- [ ] Add request ID propagation
- [ ] Remove all console.log/error from routes
- [ ] Add OpenTelemetry trace context propagation

---

## Phase 3.2: Type the Job System

**Goal**: Remove `@typescript-eslint/no-explicit-any` from job code

### Extend Job Types

**Update**: `src/server/payload/jobs/types.ts`

```typescript
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
}

// Generic typed job
export interface TypedJob<TInput, TOutput> extends JobDocument {
  input: TInput
  output?: TOutput
}

export type PdfToExercisesJob = TypedJob<PdfToExercisesInput, PdfToExercisesOutput>
```

### Update Task Handler

```typescript
// Before
export const pdfToExercisesTask = defineTask({
  handler: async ({ job, req }) => {
    const ctx = job.input.ctx as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output: any = { exerciseIds: [] }
  },
})

// After
export const pdfToExercisesTask = defineTask({
  handler: async ({ job, req }) => {
    const typedJob = job as unknown as PdfToExercisesJob
    const ctx = typedJob.input.ctx // Fully typed!
    const output: PdfToExercisesOutput = { exerciseIds: [], segmentCount: 0 }
  },
})
```

### Deliverables

- [ ] Add task-specific input/output types to types.ts
- [ ] Update [pdf-to-exercises-task.ts](../../src/server/payload/jobs/pdf-to-exercises-task.ts)
- [ ] Remove eslint-disable comments
- [ ] Add type guards where needed

---

## Phase 3.3: Extract Constants

**Goal**: Centralize magic strings and values

### Create Job Constants

**New file**: `src/server/payload/jobs/constants.ts`

```typescript
export const JOBS_COLLECTION = 'payload-jobs' as const

export const JOB_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

export type JobStatusValue = (typeof JOB_STATUS)[keyof typeof JOB_STATUS]

export const JOB_FIELDS = {
  PROCESSING: 'processing',
  HAS_ERROR: 'hasError',
  COMPLETED_AT: 'completedAt',
  STARTED_AT: 'startedAt',
  LOCK_EXPIRES_AT: 'lockExpiresAt',
} as const

export const TASK_SLUGS = {
  PDF_TO_EXERCISES: 'pdf-to-exercises',
} as const

export const LOCK_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
```

### Update JobService

```typescript
// Before
const collection = db?.connection?.collection?.('payload-jobs')

// After
import { JOBS_COLLECTION, LOCK_TIMEOUT_MS } from './constants'
const collection = db?.connection?.collection?.(JOBS_COLLECTION)
```

### Deliverables

- [ ] Create `src/server/payload/jobs/constants.ts`
- [ ] Update JobService to use constants
- [ ] Update routes to use constants
- [ ] Remove magic strings
- [ ] Consolidate constants from `src/server/config/constants.ts`

---

# Final Directory Structure

```
src/server/
├── api/
│   ├── index.ts                      # Barrel export
│   ├── responses.ts                  # Phase 1.1: apiError, apiSuccess
│   ├── with-api-handler.ts           # Phase 2.1: Route wrapper
│   ├── logger.ts                     # Phase 3.1: API logging
│   └── schemas/
│       ├── index.ts
│       └── job-schemas.ts            # Phase 1.3: Zod schemas
├── payload/
│   ├── jobs/
│   │   ├── constants.ts              # Phase 3.3: Job constants
│   │   ├── types.ts                  # Phase 1.2 + 3.2: Job types
│   │   ├── task-registry.ts          # Phase 2.3: Task registry
│   │   └── pdf-to-exercises-task.ts
│   ├── services/
│   │   ├── index.ts
│   │   ├── job-service.ts            # Phase 1.2: JobService
│   │   └── exercise-conversion-service.ts  # Phase 2.2: Business logic
│   └── utils/
│       ├── auth.ts                   # Existing (no changes)
│       └── queries.ts                # Cleanup in Phase 1.2
```

---

# Verification Plan

After each phase:

1. **Typecheck**: `pnpm typecheck`
2. **Lint**: `pnpm lint`
3. **Unit tests**: `pnpm test:unit`
4. **Integration tests**: `pnpm test:int`
5. **Manual verification**:
   - Queue a conversion job via API
   - Check job status
   - Run job immediately
   - Verify error responses match new format

---

# Summary

| Priority           | Phase | Focus              | New Files | Effort |
| ------------------ | ----- | ------------------ | --------- | ------ |
| **1 Critical**     | 0     | Quick Audit        | 0         | ~30m   |
|                    | 1.1   | Unified Responses  | 2         | ~2h    |
|                    | 1.2   | JobService         | 3         | ~3h    |
|                    | 1.3   | Request Validation | 2         | ~2h    |
| **2 Important**    | 2.1   | Route Wrapper      | 1         | ~2h    |
|                    | 2.2   | Service Layer      | 1         | ~3h    |
|                    | 2.3   | Task Registry      | 1         | ~1h    |
| **3 Nice to Have** | 3.1   | Logging            | 1         | ~1h    |
|                    | 3.2   | Job Types          | 0         | ~1h    |
|                    | 3.3   | Constants          | 1         | ~30m   |

**Total Effort**: ~16.5 hours across all phases

**Recommended Order**: 0 → 1.1 → 1.2 → 1.3 → 2.1 → 2.2 → 2.3 → 3.1 → 3.2 → 3.3

---

# Notes

- **No backward compatibility**: Internal API only, breaking changes acceptable
- **Static imports preferred**: Task registry for debugging/admin, not primary code path
- **Error distinction**: Operational errors (400) vs system errors (500) in wrapper
- **OpenTelemetry ready**: Trace context propagation in logger

---

# Test Coverage

## Existing Tests (No Changes Needed)

| File                                                                                             | Type        | Purpose                                                                   |
| ------------------------------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------- |
| [`tests/int/exercise-conversion-api.int.spec.ts`](tests/int/exercise-conversion-api.int.spec.ts) | Integration | API endpoint tests for prompts/for-conversion and exercises/convert/queue |
| [`tests/int/jobs-run-now.int.spec.ts`](tests/int/jobs-run-now.int.spec.ts)                       | Integration | Job queueing, claiming, and locking tests                                 |

## New Test Files Required

### Phase 1.1: Unified API Response Layer

**File**: `tests/unit/api/responses.spec.ts`

```typescript
import { describe, expect, it } from 'vitest'
import { apiError, apiSuccess, apiValidationError, ApiErrors } from '@/server/api/responses'
import { ZodError } from 'zod'

describe('API Response Utilities', () => {
  describe('apiError()', () => {
    it('should create error response with code and message', async () => {
      const response = apiError('NOT_FOUND', 'Resource not found', 404)
      expect(response.status).toBe(404)

      const body = await response.json()
      expect(body.error.code).toBe('NOT_FOUND')
      expect(body.error.message).toBe('Resource not found')
    })

    it('should include details when provided', async () => {
      const details = { fieldA: ['Required'], fieldB: ['Invalid format'] }
      const response = apiError('VALIDATION_ERROR', 'Validation failed', 400, details)

      const body = await response.json()
      expect(body.error.details).toEqual(details)
    })
  })

  describe('apiSuccess()', () => {
    it('should create success response with data', async () => {
      const response = apiSuccess({ jobId: '123' })
      expect(response.status).toBe(200)

      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.data.jobId).toBe('123')
    })

    it('should include message when provided', async () => {
      const response = apiSuccess({ jobId: '123' }, 'Job queued successfully')
      const body = await response.json()
      expect(body.message).toBe('Job queued successfully')
    })

    it('should use custom status code', async () => {
      const response = apiSuccess(null, 'Created', 201)
      expect(response.status).toBe(201)
    })
  })

  describe('apiValidationError()', () => {
    it('should format ZodError into details', async () => {
      const zodError = new ZodError([
        { code: 'invalid_type', path: ['jobId'], message: 'Required' },
        { code: 'invalid_string', path: ['email'], message: 'Invalid email' },
      ])

      const response = apiValidationError(zodError)
      expect(response.status).toBe(400)

      const body = await response.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.details.jobId).toContain('Required')
      expect(body.error.details.email).toContain('Invalid email')
    })
  })

  describe('ApiErrors shortcuts', () => {
    it('unauthorized should return 401', async () => {
      const response = ApiErrors.unauthorized('Token expired')
      expect(response.status).toBe(401)
      expect((await response.json()).error.code).toBe('UNAUTHORIZED')
    })

    it('forbidden should return 403', async () => {
      const response = ApiErrors.forbidden()
      expect(response.status).toBe(403)
      expect((await response.json()).error.code).toBe('FORBIDDEN')
    })

    it('notFound should include resource name', async () => {
      const response = ApiErrors.notFound('Job')
      expect(response.status).toBe(404)
      expect((await response.json()).error.message).toBe('Job not found')
    })

    it('internal should return 500', async () => {
      const response = ApiErrors.internal('Database error')
      expect(response.status).toBe(500)
      expect((await response.json()).error.code).toBe('INTERNAL_ERROR')
    })
  })
})
```

**Coverage**: `apiError()`, `apiSuccess()`, `apiValidationError()`, `ApiErrors` shortcuts

---

### Phase 1.2: JobService Abstraction

**File**: `tests/unit/payload/job-service.spec.ts`

```typescript
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { JobService } from '@/server/payload/services/job-service'
import { ObjectId } from 'mongodb'
import type { JobDocument } from '@/server/payload/jobs/types'

const mockCollection = {
  findOneAndUpdate: vi.fn(),
  updateOne: vi.fn(),
  find: vi.fn(),
  findOne: vi.fn(),
}

describe('JobService', () => {
  let service: JobService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new (JobService as any)(mockCollection)
  })

  describe('computeStatus()', () => {
    it('should return "running" when processing is true', () => {
      const doc = createMockJob({ processing: true })
      expect(service.computeStatus(doc)).toBe('running')
    })

    it('should return "failed" when hasError is true', () => {
      const doc = createMockJob({ hasError: true, processing: false })
      expect(service.computeStatus(doc)).toBe('failed')
    })

    it('should return "completed" when completedAt exists', () => {
      const doc = createMockJob({ completedAt: new Date(), processing: false, hasError: false })
      expect(service.computeStatus(doc)).toBe('completed')
    })

    it('should return "queued" when job is new', () => {
      const doc = createMockJob({ processing: false, hasError: false, completedAt: undefined })
      expect(service.computeStatus(doc)).toBe('queued')
    })

    it('should prioritize running > failed > completed > queued', () => {
      expect(
        service.computeStatus(
          createMockJob({ processing: true, hasError: true, completedAt: new Date() }),
        ),
      ).toBe('running')
      expect(
        service.computeStatus(
          createMockJob({ processing: false, hasError: true, completedAt: new Date() }),
        ),
      ).toBe('failed')
    })
  })

  describe('claimJob()', () => {
    it('should claim available job', async () => {
      const jobId = new ObjectId().toString()
      const mockJob = createMockJob({ processing: false })
      mockCollection.findOneAndUpdate.mockResolvedValue(mockJob)

      const result = await service.claimJob(jobId)

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalled()
      expect(result).toEqual(mockJob)
    })

    it('should return null if job is already processing', async () => {
      mockCollection.findOneAndUpdate.mockResolvedValue(null)
      const result = await service.claimJob(new ObjectId().toString())
      expect(result).toBeNull()
    })
  })

  describe('updateStatus()', () => {
    it('should mark job as completed', async () => {
      const jobId = new ObjectId().toString()
      await service.updateStatus(jobId, 'completed')

      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { _id: new ObjectId(jobId) },
        expect.objectContaining({
          $set: expect.objectContaining({ processing: false, hasError: false }),
        }),
      )
    })

    it('should mark job as failed', async () => {
      const jobId = new ObjectId().toString()
      await service.updateStatus(jobId, 'failed')

      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { _id: new ObjectId(jobId) },
        expect.objectContaining({
          $set: expect.objectContaining({ processing: false, hasError: true }),
        }),
      )
    })

    it('should include output when provided', async () => {
      const jobId = new ObjectId().toString()
      const output = { exerciseIds: ['id1', 'id2'] }
      await service.updateStatus(jobId, 'completed', output)

      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { _id: new ObjectId(jobId) },
        expect.objectContaining({ $set: expect.objectContaining({ output }) }),
      )
    })
  })

  describe('findByContext()', () => {
    it('should query by taskSlug only', async () => {
      const mockCursor = {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      }
      mockCollection.find.mockReturnValue(mockCursor)

      await service.findByContext('test-task', {})

      expect(mockCollection.find).toHaveBeenCalledWith({ taskSlug: 'test-task' })
    })

    it('should include lessonId in query', async () => {
      const mockCursor = {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      }
      mockCollection.find.mockReturnValue(mockCursor)

      await service.findByContext('test-task', { lessonId: 'lesson-123' })

      expect(mockCollection.find).toHaveBeenCalledWith({
        taskSlug: 'test-task',
        'input.ctx.lessonId': 'lesson-123',
      })
    })

    it('should return jobs with computed status', async () => {
      const mockJob = createMockJob({ processing: true })
      const mockCursor = {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([mockJob]),
      }
      mockCollection.find.mockReturnValue(mockCursor)

      const result = await service.findByContext('test-task', {})

      expect(result[0].status).toBe('running')
    })
  })

  describe('getById()', () => {
    it('should return null if job not found', async () => {
      mockCollection.findOne.mockResolvedValue(null)
      const result = await service.getById(new ObjectId().toString())
      expect(result).toBeNull()
    })

    it('should return job with computed status', async () => {
      const mockJob = createMockJob({ completedAt: new Date() })
      mockCollection.findOne.mockResolvedValue(mockJob)

      const result = await service.getById(new ObjectId().toString())

      expect(result?.status).toBe('completed')
    })
  })
})

function createMockJob(overrides: Partial<JobDocument>): JobDocument {
  return {
    _id: new ObjectId(),
    id: '',
    taskSlug: 'pdf-to-exercises',
    processing: false,
    hasError: false,
    createdAt: new Date(),
    input: { ctx: { lessonId: '', sourceDocId: '', tenantId: '' } },
    ...overrides,
  } as JobDocument
}
```

**Coverage**: `computeStatus()` (all 4 statuses + priority), `claimJob()`, `updateStatus()`, `extendLock()`, `findByContext()`, `getById()`

---

### Phase 1.3: Request Validation Layer

**File**: `tests/unit/api/schemas/job-schemas.spec.ts`

```typescript
import { describe, expect, it } from 'vitest'
import {
  runJobSchema,
  jobStatusQuerySchema,
  queueConversionSchema,
} from '@/server/api/schemas/job-schemas'

describe('Job Schemas', () => {
  describe('runJobSchema', () => {
    it('should accept valid ObjectId', () => {
      const validId = '507f1f77bcf86cd799439011'
      const result = runJobSchema.safeParse({ jobId: validId })
      expect(result.success).toBe(true)
    })

    it('should reject invalid ObjectId format', () => {
      const result = runJobSchema.safeParse({ jobId: 'invalid-id' })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe('Invalid ObjectId format')
    })

    it('should reject missing jobId', () => {
      const result = runJobSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('jobStatusQuerySchema', () => {
    it('should accept valid query params', () => {
      const result = jobStatusQuerySchema.safeParse({
        lessonId: '507f1f77bcf86cd799439011',
        mediaId: '507f1f77bcf86cd799439012',
        limit: '10',
      })
      expect(result.success).toBe(true)
      expect(result.data.limit).toBe(10)
    })

    it('should use default limit', () => {
      const result = jobStatusQuerySchema.safeParse({
        lessonId: '507f1f77bcf86cd799439011',
        mediaId: '507f1f77bcf86cd799439012',
      })
      expect(result.success).toBe(true)
      expect(result.data.limit).toBe(1)
    })

    it('should reject limit below 1', () => {
      const result = jobStatusQuerySchema.safeParse({
        lessonId: '507f1f77bcf86cd799439011',
        mediaId: '507f1f77bcf86cd799439012',
        limit: '0',
      })
      expect(result.success).toBe(false)
    })

    it('should reject limit above 100', () => {
      const result = jobStatusQuerySchema.safeParse({
        lessonId: '507f1f77bcf86cd799439011',
        mediaId: '507f1f77bcf86cd799439012',
        limit: '101',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('queueConversionSchema', () => {
    it('should accept valid conversion request', () => {
      const result = queueConversionSchema.safeParse({
        lessonId: '507f1f77bcf86cd799439011',
        mediaId: '507f1f77bcf86cd799439012',
        extractorPromptId: '507f1f77bcf86cd799439013',
        verifierPromptId: '507f1f77bcf86cd799439014',
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing fields', () => {
      const result = queueConversionSchema.safeParse({
        lessonId: '507f1f77bcf86cd799439011',
        mediaId: '507f1f77bcf86cd799439012',
      })
      expect(result.success).toBe(false)
    })
  })
})
```

**File**: `tests/unit/api/validation-helpers.spec.ts`

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { parseAndValidate, parseQueryParams } from '@/server/api/responses'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

describe('Validation Helpers', () => {
  let mockRequest: NextRequest

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequest = { json: vi.fn() } as unknown as NextRequest
  })

  describe('parseAndValidate()', () => {
    it('should return data on valid request', async () => {
      const schema = z.object({ jobId: z.string() })
      const mockData = { jobId: '123' }
      ;(mockRequest.json as vi.Mock).mockResolvedValue(mockData)

      const result = await parseAndValidate(mockRequest, schema)

      expect(result).toEqual({ data: mockData })
    })

    it('should return error on invalid body', async () => {
      const schema = z.object({ jobId: z.string().min(1) })
      ;(mockRequest.json as vi.Mock).mockResolvedValue({})

      const result = await parseAndValidate(mockRequest, schema)

      expect('error' in result).toBe(true)
      expect(result.error.status).toBe(400)
    })

    it('should return error on non-JSON body', async () => {
      const schema = z.object({ jobId: z.string() })
      ;(mockRequest.json as vi.Mock).mockRejectedValue(new Error('Invalid JSON'))

      const result = await parseAndValidate(mockRequest, schema)

      expect('error' in result).toBe(true)
      expect(result.error.status).toBe(400)
    })
  })

  describe('parseQueryParams()', () => {
    it('should return data on valid query params', () => {
      const schema = z.object({ limit: z.coerce.number() })
      const mockUrl = new URL('http://localhost/api?limit=10')
      mockRequest = { url: mockUrl.toString() } as unknown as NextRequest

      const result = parseQueryParams(mockRequest, schema)

      expect(result).toEqual({ data: { limit: 10 } })
    })

    it('should return error on invalid query params', () => {
      const schema = z.object({ limit: z.coerce.number().min(1) })
      const mockUrl = new URL('http://localhost/api?limit=0')
      mockRequest = { url: mockUrl.toString() } as unknown as NextRequest

      const result = parseQueryParams(mockRequest, schema)

      expect('error' in result).toBe(true)
    })
  })
})
```

**Coverage**: All Zod schemas, `parseAndValidate()`, `parseQueryParams()`

---

### Phase 2.1: API Route Wrapper

**File**: `tests/unit/api/with-api-handler.spec.ts`

```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { withApiHandler } from '@/server/api/with-api-handler'
import type { NextRequest } from 'next/server'

vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/server/payload/utils/auth', () => ({
  requireAdmin: vi.fn(),
  requireAuthenticated: vi.fn(),
  requireAdminOrTestSecret: vi.fn(),
}))
vi.mock('@/server/api/responses', () => ({
  apiError: vi.fn(),
  ApiErrors: { unauthorized: vi.fn() },
  parseAndValidate: vi.fn(),
  parseQueryParams: vi.fn(),
}))
vi.mock('@/server/api/logger', () => ({
  createApiLogger: () => ({ info: vi.fn(), error: vi.fn() }),
}))

import { getPayload } from 'payload'
import { requireAdmin, requireAuthenticated } from '@/server/payload/utils/auth'
import { parseAndValidate, parseQueryParams, apiError, ApiErrors } from '@/server/api/responses'
import { z } from 'zod'

describe('withApiHandler', () => {
  let mockRequest: NextRequest

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequest = {
      headers: new Headers(),
      url: 'http://localhost/api/test',
    } as unknown as NextRequest
  })

  describe('Authentication', () => {
    it('should pass admin auth check', async () => {
      const mockPayload = { auth: vi.fn().mockResolvedValue({ user: { id: '1', role: 'admin' } }) }
      ;(getPayload as vi.Mock).mockResolvedValue(mockPayload)
      ;(requireAdmin as vi.Mock).mockReturnValue(true)

      const handler = vi.fn().mockResolvedValue(new Response('OK'))
      const wrapped = withApiHandler({ auth: 'admin' }, handler)
      await wrapped(mockRequest)

      expect(requireAdmin).toHaveBeenCalled()
      expect(handler).toHaveBeenCalled()
    })

    it('should reject unauthenticated request', async () => {
      const mockPayload = { auth: vi.fn().mockResolvedValue({ user: null }) }
      ;(getPayload as vi.Mock).mockResolvedValue(mockPayload)
      ;(requireAdmin as vi.Mock).mockImplementation(() => {
        throw new Error('Not admin')
      })

      const handler = vi.fn()
      const wrapped = withApiHandler({ auth: 'admin' }, handler)
      const response = await wrapped(mockRequest)

      expect(handler).not.toHaveBeenCalled()
      expect(ApiErrors.unauthorized).toHaveBeenCalled()
    })
  })

  describe('Body Validation', () => {
    it('should parse and validate body with schema', async () => {
      const mockPayload = { auth: vi.fn().mockResolvedValue({ user: null }) }
      ;(getPayload as vi.Mock).mockResolvedValue(mockPayload)
      ;(parseAndValidate as vi.Mock).mockResolvedValue({ data: { jobId: '123' } })

      const schema = z.object({ jobId: z.string() })
      const handler = vi.fn().mockResolvedValue(new Response('OK'))
      const wrapped = withApiHandler({ auth: 'admin', bodySchema: schema }, handler)
      await wrapped(mockRequest)

      expect(parseAndValidate).toHaveBeenCalledWith(mockRequest, schema)
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: { jobId: '123' } }))
    })

    it('should return error when body validation fails', async () => {
      const mockPayload = { auth: vi.fn().mockResolvedValue({ user: null }) }
      ;(getPayload as vi.Mock).mockResolvedValue(mockPayload)
      const errorResponse = new Response('Error', { status: 400 })
      ;(parseAndValidate as vi.Mock).mockReturnValue({ error: errorResponse })

      const schema = z.object({ jobId: z.string() })
      const handler = vi.fn()
      const wrapped = withApiHandler({ auth: 'admin', bodySchema: schema }, handler)
      const response = await wrapped(mockRequest)

      expect(handler).not.toHaveBeenCalled()
      expect(response.status).toBe(400)
    })
  })

  describe('Error Handling', () => {
    it('should catch and handle errors', async () => {
      const mockPayload = { auth: vi.fn().mockResolvedValue({ user: null }) }
      ;(getPayload as vi.Mock).mockResolvedValue(mockPayload)
      ;(apiError as vi.Mock).mockReturnValue(new Response('Internal Error', { status: 500 }))

      const handler = vi.fn().mockRejectedValue(new Error('Something went wrong'))
      const wrapped = withApiHandler({}, handler)
      const response = await wrapped(mockRequest)

      expect(response.status).toBe(500)
    })

    it('should distinguish operational errors (400) from system errors (500)', async () => {
      const mockPayload = { auth: vi.fn().mockResolvedValue({ user: null }) }
      ;(getPayload as vi.Mock).mockResolvedValue(mockPayload)

      const operationalError = new Error('Validation failed')
      operationalError.name = 'ValidationError'

      const handler = vi.fn().mockRejectedValue(operationalError)
      const wrapped = withApiHandler({}, handler)
      await wrapped(mockRequest)

      // Should be a 400 error response
      expect((apiError as vi.Mock).mock.calls[0][2]).toBe(400)
    })
  })
})
```

**Coverage**: Auth levels, body/query validation, error handling, request ID propagation

---

### Phase 2.2: Service Layer

**File**: `tests/unit/payload/exercise-conversion-service.spec.ts`

```typescript
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { ExerciseConversionService } from '@/server/payload/services/exercise-conversion-service'
import { JobService } from '@/server/payload/services/job-service'

describe('ExerciseConversionService', () => {
  let mockPayload: any
  let mockJobService: JobService
  let service: ExerciseConversionService

  beforeEach(() => {
    mockPayload = {
      findByID: vi.fn(),
      jobs: { queue: vi.fn() },
    }
    mockJobService = {
      findByContext: vi.fn().mockResolvedValue([]),
      claimJob: vi.fn(),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    } as unknown as JobService

    service = new ExerciseConversionService(mockPayload, mockJobService)
  })

  describe('queueConversion()', () => {
    it('should throw error if lesson not found', async () => {
      mockPayload.findByID.mockResolvedValue(null)

      await expect(
        service.queueConversion({
          lessonId: 'lesson-123',
          mediaId: 'media-123',
          extractorPromptId: 'prompt-1',
          verifierPromptId: 'prompt-2',
        }),
      ).rejects.toThrow('Lesson not found')
    })

    it('should queue job with valid input', async () => {
      mockPayload.findByID.mockResolvedValue({ id: 'lesson-123', tenant: 'default' })
      mockPayload.jobs.queue.mockResolvedValue({ id: 'job-123' })

      const result = await service.queueConversion({
        lessonId: 'lesson-123',
        mediaId: 'media-123',
        extractorPromptId: 'prompt-1',
        verifierPromptId: 'prompt-2',
      })

      expect(result.jobId).toBe('job-123')
      expect(result.status).toBe('queued')
    })
  })

  describe('getConversionStatus()', () => {
    it('should return jobs for lesson and media', async () => {
      const mockJobs = [{ id: 'job-1', status: 'completed' }]
      mockJobService.findByContext.mockResolvedValue(mockJobs)

      const result = await service.getConversionStatus('lesson-123', 'media-123')

      expect(mockJobService.findByContext).toHaveBeenCalledWith(expect.any(String), {
        lessonId: 'lesson-123',
        sourceDocId: 'media-123',
      })
      expect(result).toEqual(mockJobs)
    })
  })

  describe('runJobImmediate()', () => {
    it('should throw error if job not available', async () => {
      mockJobService.claimJob.mockResolvedValue(null)

      await expect(service.runJobImmediate('job-123')).rejects.toThrow('Job not available')
    })

    it('should return result after claiming and running job', async () => {
      const mockJob = { id: 'job-123', input: { ctx: {} } }
      mockJobService.claimJob.mockResolvedValue(mockJob)

      const result = await service.runJobImmediate('job-123')

      expect(mockJobService.claimJob).toHaveBeenCalledWith('job-123')
      expect(result.jobId).toBe('job-123')
      expect(result.status).toBe('completed')
    })
  })
})
```

**Coverage**: `queueConversion()`, `getConversionStatus()`, `runJobImmediate()`

---

### Phase 2.3: Task Registry

**File**: `tests/unit/payload/task-registry.spec.ts`

```typescript
import { describe, expect, it, beforeEach } from 'vitest'
import { taskRegistry, registerTask } from '@/server/payload/jobs/task-registry'

describe('TaskRegistry', () => {
  beforeEach(() => {
    const map = (taskRegistry as any).tasks
    map.clear()
  })

  describe('register()', () => {
    it('should register a task', () => {
      const handler = async () => {}
      registerTask('test-task', handler, 'Test description')

      expect(taskRegistry.has('test-task')).toBe(true)
    })

    it('should overwrite existing task with same slug', () => {
      const handler1 = async () => {}
      const handler2 = async () => {}
      registerTask('test-task', handler1)
      registerTask('test-task', handler2)

      const task = taskRegistry.get('test-task')
      expect(task?.handler).toBe(handler2)
    })
  })

  describe('get()', () => {
    it('should return undefined for non-existent task', () => {
      expect(taskRegistry.get('non-existent')).toBeUndefined()
    })

    it('should return task with handler and description', () => {
      const handler = async () => {}
      registerTask('test-task', handler, 'Test description')

      const task = taskRegistry.get('test-task')
      expect(task?.handler).toBe(handler)
      expect(task?.description).toBe('Test description')
    })
  })

  describe('list()', () => {
    it('should return empty array when no tasks registered', () => {
      expect(taskRegistry.list()).toEqual([])
    })

    it('should return all registered task slugs', () => {
      registerTask('task-1', async () => {})
      registerTask('task-2', async () => {})
      registerTask('task-3', async () => {})

      const slugs = taskRegistry.list()
      expect(slugs).toContain('task-1')
      expect(slugs).toContain('task-2')
      expect(slugs).toContain('task-3')
    })
  })

  describe('describe()', () => {
    it('should return exists: false for non-existent task', () => {
      const result = taskRegistry.describe('non-existent')
      expect(result.exists).toBe(false)
    })

    it('should return exists: true and description for registered task', () => {
      registerTask('test-task', async () => {}, 'My task')

      const result = taskRegistry.describe('test-task')
      expect(result.exists).toBe(true)
      expect(result.description).toBe('My task')
    })
  })
})
```

**Coverage**: `register()`, `get()`, `has()`, `list()`, `describe()`

---

### Phase 3.1: Logging

**File**: `tests/unit/api/logger.spec.ts`

```typescript
import { describe, expect, it, beforeEach } from 'vitest'
import { createApiLogger } from '@/server/api/logger'
import type { NextRequest } from 'next/server'

describe('API Logger', () => {
  let mockRequest: NextRequest

  beforeEach(() => {
    mockRequest = {
      headers: new Headers(),
      method: 'GET',
      url: 'http://localhost/api/test',
    } as unknown as NextRequest
  })

  describe('createApiLogger()', () => {
    it('should create logger with route and request info', () => {
      const logger = createApiLogger(mockRequest, 'test-route')
      expect(logger).toBeDefined()
    })

    it('should extract request ID from headers', () => {
      mockRequest.headers.set('x-request-id', 'test-request-id')
      const logger = createApiLogger(mockRequest, 'test-route')
      expect(logger).toBeDefined()
    })

    it('should extract OpenTelemetry trace context', () => {
      mockRequest.headers.set('x-trace-id', 'trace-123')
      mockRequest.headers.set('x-span-id', 'span-456')
      const logger = createApiLogger(mockRequest, 'test-route')
      expect(logger).toBeDefined()
    })
  })
})
```

**Coverage**: `createApiLogger()`, request ID + OTel trace context propagation

---

### Phase 3.3: Constants

**File**: `tests/unit/payload/job-constants.spec.ts`

```typescript
import { describe, expect, it } from 'vitest'
import {
  JOBS_COLLECTION,
  JOB_STATUS,
  JOB_FIELDS,
  TASK_SLUGS,
  LOCK_TIMEOUT_MS,
} from '@/server/payload/jobs/constants'

describe('Job Constants', () => {
  describe('JOBS_COLLECTION', () => {
    it('should be payload-jobs', () => {
      expect(JOBS_COLLECTION).toBe('payload-jobs')
    })
  })

  describe('JOB_STATUS', () => {
    it('should have all status values', () => {
      expect(JOB_STATUS.QUEUED).toBe('queued')
      expect(JOB_STATUS.RUNNING).toBe('running')
      expect(JOB_STATUS.COMPLETED).toBe('completed')
      expect(JOB_STATUS.FAILED).toBe('failed')
    })
  })

  describe('JOB_FIELDS', () => {
    it('should have all field names', () => {
      expect(JOB_FIELDS.PROCESSING).toBe('processing')
      expect(JOB_FIELDS.HAS_ERROR).toBe('hasError')
      expect(JOB_FIELDS.COMPLETED_AT).toBe('completedAt')
      expect(JOB_FIELDS.STARTED_AT).toBe('startedAt')
      expect(JOB_FIELDS.LOCK_EXPIRES_AT).toBe('lockExpiresAt')
    })
  })

  describe('TASK_SLUGS', () => {
    it('should have PDF_TO_EXERCISES slug', () => {
      expect(TASK_SLUGS.PDF_TO_EXERCISES).toBe('pdf-to-exercises')
    })
  })

  describe('LOCK_TIMEOUT_MS', () => {
    it('should be 5 minutes in milliseconds', () => {
      expect(LOCK_TIMEOUT_MS).toBe(5 * 60 * 1000)
    })
  })
})
```

**Coverage**: All constants have correct values and are readonly

---

## Test File Summary

| Phase | Test File                                                | Type | Coverage                        |
| ----- | -------------------------------------------------------- | ---- | ------------------------------- |
| 1.1   | `tests/unit/api/responses.spec.ts`                       | Unit | Response utilities              |
| 1.2   | `tests/unit/payload/job-service.spec.ts`                 | Unit | JobService methods              |
| 1.2   | `tests/int/jobs-run-now.int.spec.ts`                     | Int  | Job queueing/locking (existing) |
| 1.3   | `tests/unit/api/schemas/job-schemas.spec.ts`             | Unit | Zod schemas                     |
| 1.3   | `tests/unit/api/validation-helpers.spec.ts`              | Unit | Validation helpers              |
| 2.1   | `tests/unit/api/with-api-handler.spec.ts`                | Unit | Route wrapper                   |
| 2.2   | `tests/unit/payload/exercise-conversion-service.spec.ts` | Unit | Service layer                   |
| 2.3   | `tests/unit/payload/task-registry.spec.ts`               | Unit | Task registry                   |
| 3.1   | `tests/unit/api/logger.spec.ts`                          | Unit | Logging utilities               |
| 3.3   | `tests/unit/payload/job-constants.spec.ts`               | Unit | Constants                       |

**Total new test files**: 10
**Existing test files**: 2 (no changes needed)

## Coverage Goals

- **80%+ line coverage** for new utility files
- All edge cases covered (e.g., `computeStatus` priority order, validation boundary values)
- Each test file should have descriptive `describe` blocks and meaningful assertions
