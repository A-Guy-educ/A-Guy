import type { Payload } from 'payload'
import type { Prompt } from '@/payload-types'

export interface PromptFactoryInput {
  title?: string
  promptKey?: string
  content?: string
  type?: string
  status?: 'active' | 'draft' | 'archived'
  tenant?: string
}

export function buildPromptData(input: PromptFactoryInput = {}) {
  const timestamp = Date.now()
  return {
    title: input.title ?? `Test Prompt ${timestamp}`,
    promptKey: input.promptKey ?? `test-prompt-${timestamp}`,
    content: input.content ?? 'You are a helpful test assistant.',
    type: input.type ?? 'system',
    status: input.status ?? 'active',
    ...(input.tenant ? { tenant: input.tenant } : {}),
  }
}

export async function createTestPrompt(
  payload: Payload,
  input: PromptFactoryInput = {},
): Promise<Prompt> {
  return payload.create({
    collection: 'prompts',
    data: buildPromptData(input),
    overrideAccess: true,
  })
}
