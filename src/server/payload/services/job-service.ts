import { LOCK_TIMEOUT_MS } from '@/server/payload/jobs/constants'
import { ObjectId, type Collection, type Document } from 'mongodb'
import type { Payload } from 'payload'
import { JOBS_COLLECTION } from '../jobs/constants'
import type { JobContext, JobDocument, JobStatus, JobWithStatus } from '../jobs/types'

export class JobService {
  private constructor(private readonly collection: Collection<Document> | null) {}

  static fromPayload(payload: Payload): JobService {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = payload.db as any

    // Try multiple paths to access jobs collection
    // Priority: direct connection (proven to work in integration tests) > Payload collections
    const collection =
      db.connection?.collection?.(JOBS_COLLECTION) ||
      db.collections?.['payload-jobs'] ||
      db.collections?.jobs ||
      db.collection?.(JOBS_COLLECTION) ||
      null

    if (!collection) {
      console.warn(
        '[JobService] Could not access jobs collection. Available db keys:',
        Object.keys(db || {}),
      )
    }

    return new JobService(collection as Collection<Document> | null)
  }

  computeStatus(doc: JobDocument): JobStatus {
    if (doc.processing) return 'running'
    if (doc.hasError) return 'failed'
    if (doc.completedAt) return 'completed'
    return 'queued'
  }

  async claimJob(jobId: string): Promise<JobDocument | null> {
    if (!this.collection) return null
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
    if (!this.collection) return
    const update: Record<string, unknown> = {
      processing: false,
      completedAt: new Date(),
      hasError: status === 'failed',
    }
    if (output !== undefined) update.output = output
    await this.collection.updateOne({ _id: new ObjectId(jobId) }, { $set: update })
  }

  async extendLock(jobId: string): Promise<void> {
    if (!this.collection) return
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
    overrideTaskSlug?: string,
  ): Promise<JobWithStatus[]> {
    if (!this.collection) {
      console.warn('[JobService.findByContext] No collection available')
      return []
    }
    const query: Record<string, unknown> = { taskSlug }
    if (ctx.lessonId) query['input.ctx.lessonId'] = ctx.lessonId
    if (ctx.sourceDocId) query['input.ctx.sourceDocId'] = ctx.sourceDocId
    if (ctx.tenantId) query['input.ctx.tenantId'] = ctx.tenantId
    if (overrideTaskSlug) {
      // Override the taskSlug filter (used for pipelineVersion filtering)
      delete query.taskSlug
      query.taskSlug = overrideTaskSlug
    }

    const docs = await this.collection.find(query).sort({ createdAt: -1 }).limit(limit).toArray()

    return docs.map((doc) => ({
      ...doc,
      id: doc._id.toString(),
      status: this.computeStatus(doc as unknown as JobDocument),
      // Map jobOutput to output for UI compatibility
      output: (doc as any).jobOutput || (doc as any).output,
    })) as JobWithStatus[]
  }

  async getById(jobId: string): Promise<JobWithStatus | null> {
    if (!this.collection) return null
    const doc = await this.collection.findOne({ _id: new ObjectId(jobId) })
    if (!doc) return null
    return {
      ...doc,
      id: doc._id.toString(),
      status: this.computeStatus(doc as unknown as JobDocument),
      // Map jobOutput to output for UI compatibility
      output: (doc as any).jobOutput || (doc as any).output,
    } as JobWithStatus
  }
}
