/**
 * Local mirror of /api/agent/chat/debug-prompt — runs the same code path
 * (fetchLessonContextForContext + composeFullSystemInstructions) against
 * the dev DB and dumps a comprehensive snapshot of what reaches Gemini for
 * a given lesson/exercise context.
 *
 * Usage:
 *   pnpm tsx scripts/diag-debug-prompt.ts --lessonId 69a01f6bc774d3c6ad807afd
 *   pnpm tsx scripts/diag-debug-prompt.ts --exerciseId 69a01fc38ea4786a2c666b97
 */
import 'dotenv/config'
import { composePrompt, getRecentWindow, type Message } from '@/infra/llm/context-policy'
import { logger } from '@/infra/utils/logger'
import {
  composeFullSystemInstructions,
  fetchLessonContextForContext,
  resolveContext,
} from '@/server/payload/endpoints/agent/chat/index'
import { ConversationService } from '@/server/services/conversation-service'
import config from '@payload-config'
import { getPayload } from 'payload'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const lessonId = arg('lessonId')
  const exerciseId = arg('exerciseId')
  const message = arg('message') ?? 'How many exercises does this lesson have?'
  if (!lessonId && !exerciseId) {
    console.error('Provide --lessonId <id> or --exerciseId <id>')
    process.exit(1)
  }

  const payload = await getPayload({ config })
  const conversationService = new ConversationService(payload)
  const candidate = lessonId
    ? { relationTo: 'lessons' as const, value: lessonId }
    : { relationTo: 'exercises' as const, value: exerciseId! }

  const validated = {
    message,
    acknowledgment: 'ack',
    lessonId,
    exerciseId,
  } as never

  const context = await resolveContext(conversationService, validated)
  const ownerId = 'diag-user'

  const lessonContext = await fetchLessonContextForContext(
    payload,
    context,
    { id: ownerId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logger as any,
    undefined,
  )

  const composed = await composeFullSystemInstructions(
    payload,
    lessonContext.lessonPrompt,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logger as any,
    lessonContext.coursePrompt,
    lessonContext.courseContextText,
    ownerId,
    lessonContext.lessonContextBlock,
    lessonContext.lessonContextText,
    lessonContext.exercises,
    false, // hasImageAttached
  )

  const recentMessages: Message[] = [
    { role: 'user', content: message, timestamp: new Date().toISOString() },
  ]
  const window = getRecentWindow(recentMessages)
  const composedPrompt = composePrompt(composed.instructions, {
    systemMessage: composed.instructions,
    summary: undefined,
    memoryItems: [],
    recentMessages: window,
  })

  console.log('\n=================== CONTEXT ===================')
  console.log('relationTo:', context.relationTo, '| value:', context.value)
  console.log('contextKey:', context.contextKey)

  console.log('\n=================== LESSON CONTEXT ===================')
  console.log('lessonPromptId:', (lessonContext.lessonPrompt as { id?: string } | null)?.id ?? null)
  console.log('coursePromptId:', (lessonContext.coursePrompt as { id?: string } | null)?.id ?? null)
  console.log('courseContextText length:', lessonContext.courseContextText?.length ?? 0)
  console.log('lessonContextText length:', lessonContext.lessonContextText?.length ?? 0)
  console.log('lessonContextBlock length:', lessonContext.lessonContextBlock?.length ?? 0)
  console.log('exerciseCount:', lessonContext.exercises?.length ?? 0)
  if (lessonContext.exercises) {
    console.log('exercises:')
    lessonContext.exercises.slice(0, 50).forEach((e, i) => {
      console.log(`  ${i + 1}. id=${e.id} title=${e.title ?? '(no title)'}`)
    })
  }

  console.log('\n=================== PROMPT RESOLUTION ===================')
  console.log('resolvedFrom:', composed.promptResolution.resolvedFrom)
  console.log('promptId:', composed.promptResolution.promptId ?? null)
  console.log('promptTitle:', composed.promptResolution.promptTitle ?? null)
  console.log('teacherProfileSlug:', composed.teacherProfileSlug)

  console.log('\n=================== COMPOSED SYSTEM MESSAGE ===================')
  console.log('length:', composed.instructions.length)
  console.log('---')
  console.log(composed.instructions)
  console.log('---')

  console.log('\n=================== COMPOSED PROMPT MESSAGES ===================')
  console.log('messageCount:', composedPrompt.messages.length)
  console.log('metadata:', JSON.stringify(composedPrompt.metadata))
  composedPrompt.messages.forEach((m, i) => {
    const preview = m.content.slice(0, 200).replace(/\n/g, '\\n')
    console.log(`[${i}] ${m.role} (${m.content.length} chars): ${preview}`)
  })

  if (payload.db?.destroy) await payload.db.destroy()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
