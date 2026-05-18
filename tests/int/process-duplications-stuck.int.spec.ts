/**
 * Integration test: stuck duplication record auto-fail (issue #1664).
 *
 * Acceptance criteria:
 *  1. claimAttempts field exists on LessonDuplications records (defaultValue: 0)
 *  2. Cron route increments claimAttempts on each claim (atomic $inc in findOneAndUpdate)
 *  3. Records with claimAttempts >= 5 are excluded from the claim query
 *  4. Auto-fail: record with claimAttempts >= 5 gets status=failed + STUCK_AFTER_MAX_ATTEMPTS failure entry
 *  5. Progress resets counter: when outputExercises grows, claimAttempts resets to 0
 *  6. in_progress with zero output growth does NOT reset claimAttempts
 *  7. Newer record is picked after older stuck record is excluded
 *
 * Strategy:
 *  - Create a 1-exercise lesson (so orchestrator finishes in one tick)
 *  - Create a stuck record (no exercises on source lesson so orchestrator returns in_progress each tick)
 *  - Simulate 5 ticks by manually incrementing claimAttempts
 *  - Verify auto-fail fires on tick 5
 *  - Create a "real" record that makes progress, verify counter resets
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { NextRequest } from 'next/server'

import { getDefaultTenantSlug } from '@/server/repos/tenant/get-default-tenant'
import { GET as processDuplicationsGET } from '@/app/api/cron/process-duplications/route'
import {
  runDuplicationOrchestrator,
  STUCK_FAILURE_CODE,
} from '@/server/services/lesson-duplication/orchestrator'

// Mock orchestrator to always return 'in_progress' (simulates a record that
// never makes progress — e.g. source lesson with no exercises)
vi.mock('@/server/services/lesson-duplication/orchestrator', () => ({
  runDuplicationOrchestrator: vi.fn().mockResolvedValue('in_progress'),
  STUCK_FAILURE_CODE: 'STUCK_AFTER_MAX_ATTEMPTS',
}))

const CRON_SECRET = process.env.CRON_SECRET ?? 'test-secret'

async function makeCronRequest(): Promise<Response> {
  const request = new NextRequest('http://localhost:3000/api/cron/process-duplications', {
    method: 'GET',
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  })
  return processDuplicationsGET(request)
}

async function ensureDefaultTenant(payload: Payload): Promise<string> {
  const slug = getDefaultTenantSlug()
  const existing = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs[0]) return existing.docs[0].id
  const created = await payload.create({
    collection: 'tenants',
    data: { name: slug, slug, status: 'active' },
    overrideAccess: true,
  })
  return created.id
}

describe('process-duplications stuck record auto-fail — integration', () => {
  let payload: Payload
  let tenantId: string
  let categoryId: string
  let courseId: string
  let chapterId: string
  let sourceLessonWithExerciseId: string
  let sourceLessonNoExerciseId: string

  beforeAll(async () => {
    payload = await getPayload({ config })
    tenantId = await ensureDefaultTenant(payload)
    const ts = Date.now()

    const category = await payload.create({
      collection: 'categories',
      data: { title: `StuckCat ${ts}`, slug: `stuck-cat-${ts}`, locale: 'he' },
    })
    categoryId = category.id

    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: `STUCK-${ts}`,
        title: `Stuck Course ${ts}`,
        locale: 'he',
        categories: [categoryId],
        order: 0,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        pageAccessType: 'free',
        accessType: 'free',
        contentStatus: 'none',
        contentStatusVisible: true,
      },
      draft: false,
    })
    courseId = course.id

    const chapter = await payload.create({
      collection: 'chapters',
      data: {
        title: `Stuck Chapter ${ts}`,
        chapterLabel: `SCH-${ts}`,
        course: courseId,
        order: 0,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        locale: 'he',
      },
    })
    chapterId = chapter.id

    // Source lesson WITH one exercise — used for progress-reset tests
    const lessonWithEx = await payload.create({
      collection: 'lessons',
      data: {
        title: `Stuck Source Lesson With Ex ${ts}`,
        chapter: chapterId,
        type: 'practice',
        order: 1,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        locale: 'he',
        accessType: 'inherit',
        contentStatus: 'none',
        contentStatusVisible: true,
      },
      draft: false,
    })
    sourceLessonWithExerciseId = lessonWithEx.id

    // Add one exercise to the lesson (needed for the lesson to be processable)
    await payload.create({
      collection: 'exercises',
      data: {
        title: `Exercise for ${ts}`,
        lesson: sourceLessonWithExerciseId,
        content: {
          blocks: [
            {
              id: 'q-1',
              type: 'question_select',
              variant: 'mcq',
              selectionMode: 'single',
              prompt: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: 'What is 2+2?',
                mediaIds: [],
              },
              answer: {
                multiSelect: false,
                options: [
                  {
                    id: 'a',
                    content: {
                      type: 'rich_text',
                      format: 'md-math-v1',
                      value: '3',
                      mediaIds: [],
                    },
                  },
                  {
                    id: 'b',
                    content: {
                      type: 'rich_text',
                      format: 'md-math-v1',
                      value: '4',
                      mediaIds: [],
                    },
                  },
                ],
                correctOptionIds: ['b'],
              },
              hint: { type: 'rich_text', format: 'md-math-v1', value: 'Hint', mediaIds: [] },
              solution: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: 'Solution',
                mediaIds: [],
              },
              fullSolution: {
                type: 'rich_text',
                format: 'md-math-v1',
                value: 'Full solution',
                mediaIds: [],
              },
            },
          ],
        },
      },
      draft: true,
      overrideAccess: true,
    })

    // Source lesson WITHOUT exercises — used for stuck record simulation
    const lessonNoEx = await payload.create({
      collection: 'lessons',
      data: {
        title: `Stuck Source Lesson No Ex ${ts}`,
        chapter: chapterId,
        type: 'practice',
        order: 2,
        status: 'published',
        isActive: true,
        tenant: tenantId,
        locale: 'he',
        accessType: 'inherit',
        contentStatus: 'none',
        contentStatusVisible: true,
      },
      draft: false,
    })
    sourceLessonNoExerciseId = lessonNoEx.id
  }, 120000)

  afterAll(async () => {
    await payload.db?.destroy?.()
  })

  /**
   * Per-test cleanup: the cron's claim query picks the oldest `pending` or
   * `running` record by `createdAt`. Without wiping leftover records between
   * tests, the cron would claim a record from a *previous* test instead of
   * the one the current test just created — every assertion about
   * "the record I just created" would fail because the cron operated on a
   * different one.
   *
   * We delete only pending/running records (not terminal `failed`/`succeeded`),
   * which is exactly the slice the cron's filter looks at.
   */
  beforeEach(async () => {
    const stale = await payload.find({
      collection: 'lesson-duplications',
      where: {
        or: [{ status: { equals: 'pending' } }, { status: { equals: 'running' } }],
      },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })
    for (const doc of stale.docs) {
      try {
        await payload.delete({
          collection: 'lesson-duplications',
          id: doc.id,
          overrideAccess: true,
        })
      } catch {
        // ignore — another test may have already cleaned it up
      }
    }
  })

  it('claimAttempts field exists and defaults to 0 on new records', async () => {
    const record = await payload.create({
      collection: 'lesson-duplications',
      data: {
        sourceLesson: sourceLessonWithExerciseId,
        level: 'light',
        status: 'pending',
      },
      overrideAccess: true,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((record as any).claimAttempts).toBe(0)
  })

  it('cron increments claimAttempts by 1 on each claim', async () => {
    const record = await payload.create({
      collection: 'lesson-duplications',
      data: {
        sourceLesson: sourceLessonWithExerciseId,
        level: 'light',
        status: 'pending',
      },
      overrideAccess: true,
    })

    // First cron tick: claim only (orchestrator mocked to return 'in_progress')
    await makeCronRequest()

    const after1 = await payload.findByID({
      collection: 'lesson-duplications',
      id: record.id,
      depth: 0,
      overrideAccess: true,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((after1 as any).claimAttempts).toBe(1)

    // Second tick
    await makeCronRequest()

    const after2 = await payload.findByID({
      collection: 'lesson-duplications',
      id: record.id,
      depth: 0,
      overrideAccess: true,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((after2 as any).claimAttempts).toBe(2)
  })

  it('record with claimAttempts=4 is still claimed; claimAttempts=5 is excluded', async () => {
    // record1: will be set to claimAttempts=4, should be claimed (becomes 5)
    const record1 = await payload.create({
      collection: 'lesson-duplications',
      data: {
        sourceLesson: sourceLessonNoExerciseId,
        level: 'light',
        status: 'pending',
      },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'lesson-duplications',
      id: record1.id,
      data: { claimAttempts: 4 } as never,
      overrideAccess: true,
    })

    // record2: created later (higher createdAt), claimAttempts=0, should be claimed
    const record2 = await payload.create({
      collection: 'lesson-duplications',
      data: {
        sourceLesson: sourceLessonNoExerciseId,
        level: 'light',
        status: 'pending',
      },
      overrideAccess: true,
    })

    // record1 should be claimed (claimAttempts becomes 5)
    const resp1 = await makeCronRequest()
    expect(resp1.status).toBe(200)
    const body1 = (await resp1.json()) as { duplicationId?: string }
    expect(body1.duplicationId).toBe(record1.id)

    // Set record1 to 5 — it should now be excluded
    await payload.update({
      collection: 'lesson-duplications',
      id: record1.id,
      data: { claimAttempts: 5 } as never,
      overrideAccess: true,
    })

    // record2 should now be claimed instead (record1 is stuck/excluded).
    // record2 starts with claimAttempts=0, so the cron increments it to 1
    // — well below the auto-fail threshold — and runs the orchestrator
    // normally (mocked to return 'in_progress'). The body2 outcome reflects
    // that, NOT 'failed'. Auto-fail behaviour is tested separately in the
    // next case.
    const resp2 = await makeCronRequest()
    expect(resp2.status).toBe(200)
    const body2 = (await resp2.json()) as { duplicationId?: string; outcome?: string }
    expect(body2.duplicationId).toBe(record2.id)
    expect(body2.outcome).toBe('in_progress')

    // Verify the original (excluded) record was auto-failed during tick 1.
    const finalRecord1 = await payload.findByID({
      collection: 'lesson-duplications',
      id: record1.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(finalRecord1.status).toBe('failed')
  })

  it('cron auto-fails record with claimAttempts >= 5 — status=failed + STUCK_AFTER_MAX_ATTEMPTS entry', async () => {
    const record = await payload.create({
      collection: 'lesson-duplications',
      data: {
        sourceLesson: sourceLessonNoExerciseId,
        level: 'light',
        status: 'pending',
      },
      overrideAccess: true,
    })
    // Simulate 4 prior ticks with no progress
    await payload.update({
      collection: 'lesson-duplications',
      id: record.id,
      data: { claimAttempts: 4 } as never,
      overrideAccess: true,
    })

    // Cron tick: claimAttempts becomes 5 → auto-fail
    const resp = await makeCronRequest()
    expect(resp.status).toBe(200)
    const body = (await resp.json()) as {
      outcome: string
      reason: string
      duplicationId: string
    }
    expect(body.outcome).toBe('failed')
    expect(body.reason).toBe(STUCK_FAILURE_CODE)

    // Verify DB state
    const final = await payload.findByID({
      collection: 'lesson-duplications',
      id: record.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(final.status).toBe('failed')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const failures = (final as any).failures as Array<{ code: string }>
    expect(failures.length).toBeGreaterThan(0)
    const stuckEntry = failures.find((f) => f.code === STUCK_FAILURE_CODE)
    expect(stuckEntry).toBeDefined()
  })

  it('progress (outputExercises grew) resets claimAttempts to 0', async () => {
    const record = await payload.create({
      collection: 'lesson-duplications',
      data: {
        sourceLesson: sourceLessonWithExerciseId,
        level: 'none', // 'none' level uses script strategy, no LLM calls
        status: 'pending',
      },
      overrideAccess: true,
    })
    // Simulate 1 prior tick with no progress yet
    await payload.update({
      collection: 'lesson-duplications',
      id: record.id,
      data: { claimAttempts: 1 } as never,
      overrideAccess: true,
    })

    // Override the global mock for this tick: simulate the orchestrator
    // actually doing work — append one outputExercise mapping to the record
    // mid-run. The cron's "progress detected" branch reads outputExercises
    // pre/post and only resets claimAttempts when the count grows. The global
    // mock returns 'in_progress' without touching the record, so without
    // this override the reset branch never fires.
    vi.mocked(runDuplicationOrchestrator).mockImplementationOnce(async (id) => {
      await payload.update({
        collection: 'lesson-duplications',
        id,
        data: {
          outputExercises: [
            {
              sourceExerciseId: 'simulated-src',
              outputExerciseId: 'simulated-out',
              strategy: 'script',
            },
          ],
        } as never,
        overrideAccess: true,
      })
      return 'in_progress'
    })

    // Tick: orchestrator (mocked) writes one outputExercise → cron sees
    // growth → resets claimAttempts to 0.
    const resp = await makeCronRequest()
    expect(resp.status).toBe(200)

    const after = await payload.findByID({
      collection: 'lesson-duplications',
      id: record.id,
      depth: 0,
      overrideAccess: true,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((after as any).claimAttempts).toBe(0)
  })

  it('in_progress with no output growth does NOT reset claimAttempts', async () => {
    // Source lesson has no exercises → orchestrator always returns 'in_progress'
    const record = await payload.create({
      collection: 'lesson-duplications',
      data: {
        sourceLesson: sourceLessonNoExerciseId,
        level: 'light',
        status: 'pending',
      },
      overrideAccess: true,
    })
    // Simulate 1 prior tick
    await payload.update({
      collection: 'lesson-duplications',
      id: record.id,
      data: { claimAttempts: 1 } as never,
      overrideAccess: true,
    })

    // Tick: no progress, orchestrator returns 'in_progress' → claimAttempts should increment to 2
    const resp = await makeCronRequest()
    expect(resp.status).toBe(200)

    const after = await payload.findByID({
      collection: 'lesson-duplications',
      id: record.id,
      depth: 0,
      overrideAccess: true,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((after as any).claimAttempts).toBe(2) // incremented by claim, not reset
  })

  it('newer record is picked after older stuck record is excluded', async () => {
    // oldRecord: claimAttempts=5 → stuck/excluded
    const oldRecord = await payload.create({
      collection: 'lesson-duplications',
      data: {
        sourceLesson: sourceLessonNoExerciseId,
        level: 'light',
        status: 'pending',
      },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'lesson-duplications',
      id: oldRecord.id,
      data: { claimAttempts: 5 } as never,
      overrideAccess: true,
    })

    // newRecord: claimAttempts=0, should be picked
    const newRecord = await payload.create({
      collection: 'lesson-duplications',
      data: {
        sourceLesson: sourceLessonNoExerciseId,
        level: 'light',
        status: 'pending',
      },
      overrideAccess: true,
    })

    const resp = await makeCronRequest()
    const body = (await resp.json()) as { duplicationId?: string }
    expect(body.duplicationId).toBe(newRecord.id)
  })
})
