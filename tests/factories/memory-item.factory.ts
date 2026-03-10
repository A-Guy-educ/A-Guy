import type { Payload } from 'payload'
import { ChatRole } from '@/infra/llm/chat-message-role'
import type { TestDataTracker } from '../helpers/test-data-tracker'

export interface MemoryItemFactoryInput {
  userId: string
  conversationId?: string
  contextKey?: string
  contextLevel?: 'exercise' | 'lesson' | 'chapter' | 'course' | 'global'
  type?: 'preference' | 'decision' | 'fact' | 'open_loop' | 'profile' | 'constraint' | 'other'
  text?: string
  importance?: number
  status?: 'active' | 'deprecated'
  embedding?: number[]
}

export function buildMemoryItemData(input: MemoryItemFactoryInput) {
  const embedding = input.embedding ?? Array.from({ length: 1536 }, (_, index) => index / 1000)

  return {
    userId: input.userId,
    conversationId: input.conversationId,
    contextKey: input.contextKey ?? 'global',
    contextLevel: input.contextLevel ?? 'global',
    type: input.type ?? 'fact',
    text: input.text ?? 'Test memory item',
    importance: input.importance ?? 3,
    embedding,
    status: input.status ?? 'active',
    source: {
      sourceMessageTimestamp: new Date().toISOString(),
      sourceMessageRole: ChatRole.User,
    },
  }
}

export async function createMemoryItem(
  payload: Payload,
  input: MemoryItemFactoryInput,
  tracker?: TestDataTracker,
) {
  const item = await payload.create({
    collection: 'memory_items',
    data: buildMemoryItemData(input),
    overrideAccess: true,
  })
  tracker?.track('memory_items', item.id)
  return item
}
