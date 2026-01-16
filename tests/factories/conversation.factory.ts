import type { Payload } from 'payload'
import { ChatRole } from '@/lib/ai/chat-message-role'

export interface ConversationMessageInput {
  role?: ChatRole
  content?: string
  timestamp?: string
}

export interface ConversationFactoryInput {
  userId: string
  contextRef: {
    relationTo: 'courses' | 'chapters' | 'lessons' | 'exercises'
    value: string
  }
  messages?: ConversationMessageInput[]
  summary?: string
}

export function buildChatMessage(input: ConversationMessageInput = {}) {
  return {
    role: input.role ?? ChatRole.User,
    content: input.content ?? 'Test message',
    timestamp: input.timestamp ?? new Date().toISOString(),
  }
}

export function buildConversationData(input: ConversationFactoryInput) {
  const messages = (input.messages ?? []).map((message) => buildChatMessage(message))
  const lastMessageAt = messages.length
    ? messages[messages.length - 1].timestamp
    : new Date().toISOString()

  return {
    user: input.userId,
    contextRef: input.contextRef,
    messages,
    summary: input.summary ?? '',
    contextPolicyVersion: 'v1',
    lastMessageAt,
  }
}

export async function createConversation(payload: Payload, input: ConversationFactoryInput) {
  return payload.create({
    collection: 'conversations',
    data: buildConversationData(input),
    draft: false,
    overrideAccess: true,
  })
}
