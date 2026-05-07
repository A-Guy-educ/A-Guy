/**
 * Diagnostic: load an exercise via the local Payload API exactly the way
 * fetchExerciseLessonContext does and print the lessonContextBlock that
 * would reach the model. Run against the dev database to see why the
 * preview model behaves as if the exercise has no body.
 *
 * Usage: pnpm tsx scripts/diag-exercise-context.ts <exerciseId>
 */
import 'dotenv/config'
import config from '@payload-config'
import { getPayload } from 'payload'
import { fetchLessonContextForContext } from '@/server/payload/endpoints/agent/chat/prompt-composition'
import { logger } from '@/infra/utils/logger'

async function main() {
  const exerciseId = process.argv[2] || '69a01fc38ea4786a2c666b97'
  const payload = await getPayload({ config })

  // Mimic the pipeline
  const ctx = await fetchLessonContextForContext(
    payload,
    { relationTo: 'exercises', value: exerciseId, contextKey: `exercises:${exerciseId}` },
    { id: 'diag-user' },
    logger as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  )

  console.log('=== fetchLessonContextForContext result ===')
  console.log('lessonPrompt:', ctx.lessonPrompt ? `id=${(ctx.lessonPrompt as any).id}` : null)
  console.log('coursePrompt:', ctx.coursePrompt ? `id=${(ctx.coursePrompt as any).id}` : null)
  console.log('courseContextText:', ctx.courseContextText)
  console.log('lessonContextBlock length:', ctx.lessonContextBlock?.length ?? 0)
  console.log('---- block preview ----')
  console.log(ctx.lessonContextBlock || '<empty>')

  if (payload.db?.destroy) await payload.db.destroy()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
