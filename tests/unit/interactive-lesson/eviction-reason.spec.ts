/**
 * Pins the cache eviction reasons used by the lesson generation endpoint.
 *
 * The eviction logic is the kind of "looks fine until a future schema
 * change" code that benefits from explicit cases: when a new reason is
 * added or an existing one is renamed silently, these tests catch it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  evictionReason,
  isDuplicateKeyError,
  isWellFormedLesson,
} from '@/server/payload/endpoints/agent/generate-interactive-lesson'
import * as promptCacheModule from '@/infra/llm/services/interactive-lesson/published-prompt-cache'
import { INTERACTIVE_LESSON_CACHE_SCHEMA_VERSION } from '@/infra/llm/services/interactive-lesson/cache-schema-version'
import type { Payload } from 'payload'
import type { InteractiveLesson as CachedLessonDoc } from '@/payload-types'

// A minimal "well-formed" lesson body — everything else can be stubs.
const goodLesson = {
  title: 'A lesson',
  steps: [{ id: 1 }],
  geometry: { points: [], segments: [] },
}

function row(overrides: Partial<CachedLessonDoc>): CachedLessonDoc {
  return {
    id: 'row-1',
    user: 'u-1',
    media: 'm-1',
    locale: 'en',
    lesson: goodLesson,
    cacheSchemaVersion: INTERACTIVE_LESSON_CACHE_SCHEMA_VERSION,
    promptId: 'p-1',
    promptUpdatedAt: '2026-04-01T00:00:00.000Z',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  } as CachedLessonDoc
}

const fakePayload = {} as unknown as Payload

describe('isWellFormedLesson', () => {
  it('accepts the canonical shape', () => {
    expect(isWellFormedLesson(goodLesson)).toBe(true)
  })
  it('rejects null / non-object', () => {
    expect(isWellFormedLesson(null)).toBe(false)
    expect(isWellFormedLesson('lesson')).toBe(false)
    expect(isWellFormedLesson(42)).toBe(false)
  })
  it('rejects when title is missing or non-string', () => {
    expect(isWellFormedLesson({ ...goodLesson, title: undefined })).toBe(false)
    expect(isWellFormedLesson({ ...goodLesson, title: 123 })).toBe(false)
  })
  it('rejects when steps is missing or empty', () => {
    expect(isWellFormedLesson({ ...goodLesson, steps: undefined })).toBe(false)
    expect(isWellFormedLesson({ ...goodLesson, steps: [] })).toBe(false)
    expect(isWellFormedLesson({ ...goodLesson, steps: 'not-an-array' })).toBe(false)
  })
  it('rejects when geometry is missing or non-object', () => {
    expect(isWellFormedLesson({ ...goodLesson, geometry: undefined })).toBe(false)
    expect(isWellFormedLesson({ ...goodLesson, geometry: 'oops' })).toBe(false)
  })
})

describe('isDuplicateKeyError', () => {
  it('detects code 11000', () => {
    expect(isDuplicateKeyError({ code: 11000 })).toBe(true)
  })
  it('detects E11000 in the message', () => {
    expect(isDuplicateKeyError(new Error('E11000 duplicate key on prompts.id_1'))).toBe(true)
  })
  it('detects "duplicate key" in the message (case-insensitive)', () => {
    expect(isDuplicateKeyError({ message: 'Duplicate key collision' })).toBe(true)
  })
  it('returns false for unrelated errors', () => {
    expect(isDuplicateKeyError(new Error('boom'))).toBe(false)
    expect(isDuplicateKeyError({ code: 500 })).toBe(false)
    expect(isDuplicateKeyError(null)).toBe(false)
    expect(isDuplicateKeyError('string-error')).toBe(false)
  })
})

describe('evictionReason', () => {
  let getPromptSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Default: a published prompt matching the cache row's provenance.
    getPromptSpy = vi
      .spyOn(promptCacheModule, 'getPublishedInteractiveLessonPrompt')
      .mockResolvedValue({
        id: 'p-1',
        template: 'template body',
        updatedAt: '2026-04-01T00:00:00.000Z',
      })
  })
  afterEach(() => {
    getPromptSpy.mockRestore()
  })

  it('returns null (do not evict) when version, shape, and prompt all match', async () => {
    const reason = await evictionReason(fakePayload, row({}))
    expect(reason).toBeNull()
  })

  it('evicts on cache schema version mismatch FIRST (before any prompt query)', async () => {
    const reason = await evictionReason(fakePayload, row({ cacheSchemaVersion: 'old-v0' }))
    expect(reason).toBe('cache-schema-version-mismatch')
    // Critical: a stale-shape row should not pay a DB round-trip just to decide.
    expect(getPromptSpy).not.toHaveBeenCalled()
  })

  it('evicts when the cached lesson body is malformed', async () => {
    const reason = await evictionReason(
      fakePayload,
      row({ lesson: { title: 'x' } as unknown as CachedLessonDoc['lesson'] }),
    )
    expect(reason).toBe('malformed-lesson-shape')
  })

  it('evicts when no prompt provenance was recorded (legacy row)', async () => {
    const reason = await evictionReason(fakePayload, row({ promptId: undefined }))
    expect(reason).toBe('missing-prompt-provenance')
  })

  it('evicts when the published prompt id has changed', async () => {
    getPromptSpy.mockResolvedValueOnce({
      id: 'p-2-different',
      template: 'newer template',
      updatedAt: '2026-04-02T00:00:00.000Z',
    })
    const reason = await evictionReason(fakePayload, row({ promptId: 'p-1' }))
    expect(reason).toBe('prompt-id-changed')
  })

  it('evicts when the published prompt updatedAt has moved forward', async () => {
    getPromptSpy.mockResolvedValueOnce({
      id: 'p-1',
      template: 'template body',
      updatedAt: '2026-05-01T00:00:00.000Z',
    })
    const reason = await evictionReason(
      fakePayload,
      row({ promptUpdatedAt: '2026-04-01T00:00:00.000Z' }),
    )
    expect(reason).toBe('prompt-updated')
  })

  it('keeps serving when the current prompt has been deleted (no fresher option)', async () => {
    getPromptSpy.mockResolvedValueOnce(null)
    const reason = await evictionReason(fakePayload, row({}))
    expect(reason).toBeNull()
  })

  it('does NOT false-positive on Date-vs-string format drift', async () => {
    // Cached as a Date-stringified value, current returned as ISO. The
    // normalize step on read should make them equal.
    getPromptSpy.mockResolvedValueOnce({
      id: 'p-1',
      template: 'template body',
      updatedAt: '2026-04-01T00:00:00.000Z',
    })
    const reason = await evictionReason(
      fakePayload,
      row({ promptUpdatedAt: 'Wed, 01 Apr 2026 00:00:00 GMT' }),
    )
    expect(reason).toBeNull()
  })
})
