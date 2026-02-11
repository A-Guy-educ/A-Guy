/**
 * Seed Incorrect Answer Help Prompt
 *
 * Creates the default prompt template used when a student submits an incorrect answer.
 * Admins can edit this in the admin panel under AI > Prompts.
 *
 * Template variables:
 *   {{questionData}} - Full question JSON
 *   {{studentAnswer}} - The student's formatted answer
 */
import type { Payload } from 'payload'

const PROMPT_KEY = 'incorrect-answer-help'

const defaultTemplate = `The student answered incorrectly. Here is the full question data:
{{questionData}}

The student's answer was: "{{studentAnswer}}"

Please help them understand why their answer is wrong and guide them toward the correct solution. Be encouraging and supportive.`

export async function seedIncorrectAnswerPrompt(payload: Payload, tenantId: string): Promise<void> {
  const existing = await payload.find({
    collection: 'prompts',
    where: { key: { equals: PROMPT_KEY } },
    limit: 1,
    overrideAccess: true,
  })

  if (existing.docs.length > 0) {
    payload.logger.info(`— Prompt "${PROMPT_KEY}" already exists, skipping`)
    return
  }

  await payload.create({
    collection: 'prompts',
    overrideAccess: true,
    data: {
      title: 'Incorrect Answer Help',
      key: PROMPT_KEY,
      type: 'context',
      template: defaultTemplate,
      status: 'published',
      usage: 'chat',
      tenant: tenantId,
    },
  })

  payload.logger.info(`— Created prompt "${PROMPT_KEY}"`)
}
