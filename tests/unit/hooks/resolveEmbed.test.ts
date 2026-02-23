import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { CollectionBeforeChangeHook } from 'payload'
import { resolveEmbedHook } from '@/server/payload/collections/Media/hooks/resolveEmbed'
import { MediaType } from '@/infra/media/types'

// Mock the embed resolver so we don't make real HTTP requests
vi.mock('@/infra/media/embed', () => ({
  resolveEmbedUrl: vi.fn(),
}))

import { resolveEmbedUrl } from '@/infra/media/embed'

// Helper to create a mock Payload req object
function createMockReq() {
  return {
    payload: {
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      },
    },
  } as unknown as Parameters<CollectionBeforeChangeHook>[0]['req']
}

// Helper to call the hook with partial args
function callHook(args: {
  data: Record<string, unknown>
  operation: 'create' | 'update'
  originalDoc?: Record<string, unknown>
}) {
  return resolveEmbedHook({
    data: args.data,
    operation: args.operation,
    originalDoc: args.originalDoc ?? {},
    req: createMockReq(),
    collection: {
      slug: 'media',
    } as unknown as Parameters<CollectionBeforeChangeHook>[0]['collection'],
    context: {},
  } as Parameters<CollectionBeforeChangeHook>[0])
}

describe('resolveEmbedHook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should resolve YouTube URL on create', async () => {
    vi.mocked(resolveEmbedUrl).mockResolvedValue({
      provider: 'youtube',
      videoId: 'dQw4w9WgXcQ',
      embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      title: 'Rick Astley - Never Gonna Give You Up',
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    })

    const result = await callHook({
      data: {
        type: MediaType.External,
        externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
      operation: 'create',
    })

    expect(result.embedProvider).toBe('youtube')
    expect(result.embedVideoId).toBe('dQw4w9WgXcQ')
    expect(result.embedUrl).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(result.embedTitle).toBe('Rick Astley - Never Gonna Give You Up')
    expect(result.embedThumbnailUrl).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
  })

  it('should skip resolution on update when URL has not changed', async () => {
    const data = {
      type: MediaType.External,
      externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    }

    const result = await callHook({
      data,
      operation: 'update',
      originalDoc: {
        externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        embedProvider: 'youtube',
      },
    })

    // Should NOT have called the resolver
    expect(resolveEmbedUrl).not.toHaveBeenCalled()
    expect(result).toEqual(data) // data unchanged
  })

  it('should re-resolve on update when URL has changed', async () => {
    vi.mocked(resolveEmbedUrl).mockResolvedValue({
      provider: 'youtube',
      videoId: 'newVideoIdxx',
      embedUrl: 'https://www.youtube-nocookie.com/embed/newVideoIdxx',
      title: 'New Video',
      thumbnailUrl: 'https://thumb.jpg',
    })

    const result = await callHook({
      data: {
        type: MediaType.External,
        externalUrl: 'https://www.youtube.com/watch?v=newVideoIdxx',
      },
      operation: 'update',
      originalDoc: {
        externalUrl: 'https://www.youtube.com/watch?v=oldVideoIdxx',
        embedProvider: 'youtube',
      },
    })

    expect(resolveEmbedUrl).toHaveBeenCalledWith('https://www.youtube.com/watch?v=newVideoIdxx')
    expect(result.embedVideoId).toBe('newVideoIdxx')
  })

  it('should clear embed fields when type changes away from external', async () => {
    const result = await callHook({
      data: {
        type: MediaType.Image,
      },
      operation: 'update',
      originalDoc: {
        embedProvider: 'youtube',
        embedVideoId: 'oldId',
        embedUrl: 'https://old-url',
        embedTitle: 'Old Title',
        embedThumbnailUrl: 'https://old-thumb',
      },
    })

    expect(result.embedProvider).toBeNull()
    expect(result.embedVideoId).toBeNull()
    expect(result.embedUrl).toBeNull()
    expect(result.embedTitle).toBeNull()
    expect(result.embedThumbnailUrl).toBeNull()
  })

  it('should not fail the save if embed resolution throws', async () => {
    vi.mocked(resolveEmbedUrl).mockRejectedValue(new Error('Network failure'))

    const data = {
      type: MediaType.External,
      externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    }

    // Should NOT throw — the save continues without embed metadata
    const result = await callHook({
      data,
      operation: 'create',
    })

    // Data should be returned unchanged (no embed fields added)
    expect(result.embedProvider).toBeUndefined()
  })

  it('should skip when type is external but no URL provided', async () => {
    const data = {
      type: MediaType.External,
      externalUrl: null,
    }

    const result = await callHook({
      data,
      operation: 'create',
    })

    expect(resolveEmbedUrl).not.toHaveBeenCalled()
    expect(result).toEqual(data)
  })

  it('should handle generic (non-YouTube) URL', async () => {
    vi.mocked(resolveEmbedUrl).mockResolvedValue({
      provider: 'generic',
      videoId: null,
      embedUrl: 'https://example.com/widget',
      title: null,
      thumbnailUrl: null,
    })

    const result = await callHook({
      data: {
        type: MediaType.External,
        externalUrl: 'https://example.com/widget',
      },
      operation: 'create',
    })

    expect(result.embedProvider).toBe('generic')
    expect(result.embedVideoId).toBeNull()
    expect(result.embedUrl).toBe('https://example.com/widget')
  })
})
