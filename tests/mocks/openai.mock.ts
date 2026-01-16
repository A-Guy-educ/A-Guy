import { vi } from 'vitest'

type EmbeddingsResponse = {
  data: Array<{ embedding: number[]; index: number; object: string }>
  model: string
  usage: { prompt_tokens: number; total_tokens: number }
  object: string
}

type ChatResponse = {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: { role: string; content: string }
    finish_reason: string
  }>
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

export function createOpenAIMock(options?: {
  embeddingDimension?: number
  embeddingError?: Error
  chatError?: Error
  chatContent?: string
}) {
  const embeddingDimension = options?.embeddingDimension ?? 1536
  const chatContent = options?.chatContent ?? 'Mock response'

  const embeddingsCreate = vi.fn(async () => {
    if (options?.embeddingError) {
      throw options.embeddingError
    }

    const embedding = Array.from({ length: embeddingDimension }, (_, index) => index / 1000)
    const response: EmbeddingsResponse = {
      data: [{ embedding, index: 0, object: 'embedding' }],
      model: 'text-embedding-3-small',
      usage: { prompt_tokens: 10, total_tokens: 10 },
      object: 'list',
    }
    return response
  })

  const chatCreate = vi.fn(async () => {
    if (options?.chatError) {
      throw options.chatError
    }

    const response: ChatResponse = {
      id: 'chatcmpl-mock',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4o-mini',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: chatContent },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
    }

    return response
  })

  class MockOpenAI {
    embeddings = { create: embeddingsCreate }
    chat = { completions: { create: chatCreate } }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_options: unknown) {}
  }

  return { MockOpenAI, embeddingsCreate, chatCreate }
}
