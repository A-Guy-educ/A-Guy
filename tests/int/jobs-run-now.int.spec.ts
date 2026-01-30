import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { ObjectId } from 'mongodb'
import { getPayload, Payload } from 'payload'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
let originalDatabaseUrl: string | undefined

describe('Jobs Run Now', () => {
  beforeAll(async () => {
    // Save original DATABASE_URL and unset it before starting testcontainers
    originalDatabaseUrl = process.env.DATABASE_URL
    // @ts-expect-error - TypeScript doesn't allow delete on process.env
    delete process.env.DATABASE_URL

    // Start MongoDB test container and set DATABASE_URL to testcontainers URL
    const mongoUri = await startMongoContainer()
    process.env.DATABASE_URL = mongoUri

    // Import config AFTER setting DATABASE_URL so it uses the test database
    const config = await import('@payload-config')

    // Initialize Payload with the test MongoDB
    payload = await getPayload({ config: config.default })
  }, 120000)

  afterAll(async () => {
    // Restore original DATABASE_URL
    if (originalDatabaseUrl !== undefined) {
      process.env.DATABASE_URL = originalDatabaseUrl
    } else {
      // @ts-expect-error
      delete process.env.DATABASE_URL
    }

    // Stop MongoDB container
    await stopMongoContainer()
  })

  it('should queue a job and allow claiming it (run-now simulation)', async () => {
    // Create a test tenant first (required for exercises)
    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: `Test Tenant ${Date.now()}`,
        slug: `test-tenant-${Date.now()}`,
      } as any,
    })

    // Create a test user with admin role
    const user = await payload.create({
      collection: 'users',
      data: {
        email: `test-${Date.now()}@example.com`,
        password: 'test-password-123',
        role: 'admin',
      },
    })

    // Create a test category first (required for courses)
    const category = await payload.create({
      collection: 'categories',
      data: {
        title: 'Test Category',
        slug: `test-category-${Date.now()}`,
      },
    })

    // Create a test course and chapter
    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: 'Test',
        title: 'Test Course',
        slug: `test-course-${Date.now()}`,
        tenant: tenant.id,
        categories: [category.id],
        order: 0,
        status: 'published',
        isActive: true,
      } as any,
    })

    const chapter = await payload.create({
      collection: 'chapters',
      data: {
        title: 'Test Chapter',
        course: course.id,
        order: 1,
        tenant: tenant.id,
      } as any,
    })

    // Create a test lesson
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: 'Test Lesson',
        chapter: chapter.id,
        type: 'practice',
        status: 'published',
        tenant: tenant.id,
      } as any,
    })

    // Create a test media
    const media = await payload.create({
      collection: 'media',
      data: {
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        url: 'https://example.com/test.pdf',
        filesize: 1000,
      } as any,
    })

    // Create test prompts
    const extractorPrompt = await payload.create({
      collection: 'prompts',
      data: {
        slug: `test-extractor-${Date.now()}`,
        usage: 'extractor',
        template: 'Extract exercises from this content.',
        status: 'published',
        tenant: tenant.id,
      } as any,
    })

    const verifierPrompt = await payload.create({
      collection: 'prompts',
      data: {
        slug: `test-verifier-${Date.now()}`,
        usage: 'verifier',
        template: 'Verify this exercise is valid.',
        status: 'published',
        tenant: tenant.id,
      } as any,
    })

    // Queue a job
    const job = await payload.jobs.queue({
      task: 'pdf_to_exercises',
      input: {
        ctx: { lessonId: lesson.id, sourceDocId: media.id, tenantId: tenant.id },
        maxSegmentPages: 2,
        promptRefs: { extractorPromptId: extractorPrompt.id, verifierPromptId: verifierPrompt.id },
        promptSnapshot: {
          extractor: extractorPrompt.template,
          verifier: verifierPrompt.template,
        },
        promptSnapshotHash: {
          extractor: 'test-hash-1',
          verifier: 'test-hash-2',
        },
      },
    })

    // Verify job is queued
    expect(job.id).toBeDefined()
    expect(job.taskSlug).toBe('pdf_to_exercises')

    // Access the jobs collection directly to check status
    const db = payload.db as any
    const jobsColl = db.connection?.collection?.('payload-jobs')
    const jobDoc = await jobsColl.findOne({ _id: new ObjectId(job.id) })

    expect(jobDoc).toBeDefined()
    expect(jobDoc.processing).toBe(false)
    expect(jobDoc.completedAt).toBeUndefined()

    // Simulate run-now by claiming the job
    const now = new Date()
    const lockExpiresAt = new Date(now.getTime() + 60000)

    const claimedJob = await jobsColl.findOneAndUpdate(
      { _id: new ObjectId(job.id), processing: { $ne: true } },
      {
        $set: {
          processing: true,
          startedAt: now,
          lockExpiresAt,
        },
      },
      { returnDocument: 'after' },
    )

    expect(claimedJob).toBeDefined()
    expect(claimedJob.processing).toBe(true)

    // Clean up
    await jobsColl.deleteOne({ _id: new ObjectId(job.id) })
    await payload.delete({ collection: 'lessons', id: lesson.id })
    await payload.delete({ collection: 'chapters', id: chapter.id })
    await payload.delete({ collection: 'courses', id: course.id })
    await payload.delete({ collection: 'media', id: media.id })
    await payload.delete({ collection: 'prompts', id: extractorPrompt.id })
    await payload.delete({ collection: 'prompts', id: verifierPrompt.id })
    await payload.delete({ collection: 'users', id: user.id })
    await payload.delete({ collection: 'tenants', id: tenant.id })
  })

  it('should fail concurrent claims (lock contention)', async () => {
    const db = payload.db as any
    const jobsColl = db.connection?.collection?.('payload-jobs')

    // Create a job
    const job = await payload.jobs.queue({
      task: 'pdf_to_exercises',
      input: {
        ctx: { lessonId: 'test-lesson', sourceDocId: 'test-media', tenantId: 'test-tenant' },
        maxSegmentPages: 2,
        promptRefs: { extractorPromptId: 'test-extractor', verifierPromptId: 'test-verifier' },
        promptSnapshot: { extractor: 'test', verifier: 'test' },
        promptSnapshotHash: { extractor: 'hash1', verifier: 'hash2' },
      },
    })

    // First claim should succeed
    const firstClaim = await jobsColl.findOneAndUpdate(
      { _id: new ObjectId(job.id), processing: { $ne: true } },
      {
        $set: {
          processing: true,
          startedAt: new Date(),
          lockExpiresAt: new Date(Date.now() + 60000),
        },
      },
      { returnDocument: 'after' },
    )

    expect(firstClaim).toBeDefined()

    // Second claim should fail (job is already processing)
    const secondClaim = await jobsColl.findOneAndUpdate(
      { _id: new ObjectId(job.id), processing: { $ne: true } },
      {
        $set: {
          processing: true,
          startedAt: new Date(),
          lockExpiresAt: new Date(Date.now() + 60000),
        },
      },
      { returnDocument: 'after' },
    )

    expect(secondClaim).toBeNull()

    // Clean up
    await jobsColl.deleteOne({ _id: new ObjectId(job.id) })
  })
})
