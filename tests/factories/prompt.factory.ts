import type { Payload } from 'payload'
import type { Prompt } from '@/payload-types'

export interface PromptFactoryInput {
  title?: string
  promptKey?: string
  content?: string
  type?: 'system' | 'context' | 'persona'
  status?: 'draft' | 'published' | 'archived'
  tenant?: string
}

export function buildPromptData(input: PromptFactoryInput = {}) {
  const timestamp = Date.now()
  return {
    title: input.title ?? `Test Prompt ${timestamp}`,
    promptKey: input.promptKey ?? `test-prompt-${timestamp}`,
    content: input.content ?? 'You are a helpful test assistant.',
    type: input.type ?? 'system',
    status: input.status ?? 'draft',
    ...(input.tenant ? { tenant: input.tenant } : {}),
  }
}

export async function createTestPrompt(
  payload: Payload,
  input: PromptFactoryInput = {},
): Promise<Prompt> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test factory: Payload's create() union types are strict
  return payload.create({
    collection: 'prompts',
    data: buildPromptData(input) as any,
    overrideAccess: true,
  })
}
