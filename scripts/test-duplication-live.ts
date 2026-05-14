/**
 * Live test of the lesson duplication pipeline against real Mongo + real Gemini.
 *
 * Skips the queue runner (calls the orchestrator directly) so we don't depend
 * on Next.js being up. Tests everything else end-to-end: prompt loading, the
 * two-pass variation service, rate-limit + circuit-breaker handling, structural
 * + semantic validators, output lesson creation.
 *
 * Usage: pnpm tsx scripts/test-duplication-live.ts <lessonId> [level] [subject]
 *   level   = light | medium | deep (default deep)
 *   subject = algebra | geometry | calculus | mixed | other (default calculus)
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })

// Safety guard: this script creates real database records AND bills real
// Gemini calls. Refuse to run against anything that looks like a production
// Mongo URI unless the operator explicitly opts in.
function assertSafeEnvironment(): void {
  if (process.env.ALLOW_LIVE === '1') return
  const uri = process.env.DATABASE_URI ?? process.env.MONGODB_URI ?? ''
  const isLocal =
    uri.includes('localhost') ||
    uri.includes('127.0.0.1') ||
    uri.includes('mongo:') /* docker-compose service */
  if (!isLocal) {
    console.error(
      '[live-test] Refusing to run against non-local Mongo. ' +
        'DATABASE_URI does not point at localhost. ' +
        'Set ALLOW_LIVE=1 to override (you are about to mutate prod data and bill Gemini).',
    )
    process.exit(1)
  }
}
assertSafeEnvironment()

import { getPayload } from 'payload'
import config from '@payload-config'

import { runDuplicationOrchestrator } from '@/server/services/lesson-duplication/orchestrator'
import type { DuplicationLevel } from '@/server/payload/collections/LessonDuplications'

const lessonId = process.argv[2]
const level = (process.argv[3] ?? 'deep') as DuplicationLevel
const subject = process.argv[4] ?? 'calculus'

if (!lessonId) {
  console.error('Usage: pnpm tsx scripts/test-duplication-live.ts <lessonId> [level] [subject]')
  process.exit(1)
}

async function main() {
  console.log(`[live-test] level=${level} subject=${subject} lessonId=${lessonId}`)
  console.log('[live-test] Initialising Payload...')
  const payload = await getPayload({ config })

  // Verify lesson exists
  const lesson = await payload.findByID({
    collection: 'lessons',
    id: lessonId,
    depth: 0,
    overrideAccess: true,
  })
  console.log(`[live-test] Source lesson title="${lesson.title}"`)

  const exercises = await payload.find({
    collection: 'exercises',
    where: { lesson: { equals: lessonId } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  console.log(`[live-test] Source has ${exercises.docs.length} exercises`)

  // Create LessonDuplications record (status=pending)
  const record = await payload.create({
    collection: 'lesson-duplications',
    data: {
      sourceLesson: lessonId,
      level,
      subject,
      status: 'pending',
    } as never,
    overrideAccess: true,
  })
  console.log(`[live-test] Created duplication record id=${record.id}`)

  // Run orchestrator directly (skip queue/runner)
  const start = Date.now()
  console.log('[live-test] Invoking orchestrator (this will hit Gemini)...')
  try {
    await runDuplicationOrchestrator(record.id as string, payload)
  } catch (err) {
    console.error('[live-test] Orchestrator threw:', err)
  }
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`[live-test] Orchestrator finished in ${elapsed}s`)

  // Fetch the final record
  const finalRecord = await payload.findByID({
    collection: 'lesson-duplications',
    id: record.id as string,
    depth: 1,
    overrideAccess: true,
  })

  console.log('\n========== RESULT ==========')
  console.log(`status:       ${finalRecord.status}`)
  console.log(
    `outputLesson: ${
      typeof finalRecord.outputLesson === 'string'
        ? finalRecord.outputLesson
        : ((finalRecord.outputLesson as { id?: string })?.id ?? '(none)')
    }`,
  )
  const failures = (finalRecord.failures as Array<{ code: string; message: string }>) ?? []
  const outputExercises =
    (finalRecord.outputExercises as Array<{
      sourceExerciseId: string
      outputExerciseId: string
    }>) ?? []
  console.log(`succeeded:    ${outputExercises.length} exercise(s)`)
  console.log(`failures:     ${failures.length}`)
  for (const f of failures) {
    console.log(`  - [${f.code}] ${f.message.slice(0, 200)}`)
  }
  console.log('============================\n')

  await payload.db?.destroy?.()
  process.exit(failures.length === 0 ? 0 : 2)
}

void main().catch((err) => {
  console.error('[live-test] Fatal:', err)
  process.exit(1)
})
