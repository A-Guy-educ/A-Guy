import { vi } from 'vitest'
import type { RetrievalResult } from '@/lib/ai/vector-search'

export function createVectorSearchMock(overrides?: Partial<RetrievalResult>) {
  const retrieveMemoryItems = vi.fn(async () => ({
    items: [],
    localCount: 0,
    contextCount: 0,
    parentCount: 0,
    globalCount: 0,
    hierarchyKeys: [],
    latencyMs: 0,
    ...overrides,
  }))

  const findSimilarMemoryItem = vi.fn(async () => null)

  return { retrieveMemoryItems, findSimilarMemoryItem }
}
