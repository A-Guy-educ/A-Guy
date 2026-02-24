import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolveEmbedUrl } from '@/infra/media/embed/resolve'

// Mock resolvers so we test the routing logic, not provider-specific parsing
vi.mock('@/infra/media/embed/youtube', () => ({
  resolveYouTube: vi.fn(),
}))

vi.mock('@/infra/media/embed/vimeo', () => ({
  resolveVimeo: vi.fn(),
}))

import { resolveYouTube } from '@/infra/media/embed/youtube'
import { resolveVimeo } from '@/infra/media/embed/vimeo'

describe('resolveEmbedUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return YouTube metadata when URL is a YouTube URL', async () => {
    const mockMetadata = {
      provider: 'youtube' as const,
      videoId: 'abc123xxxxx',
      embedUrl: 'https://www.youtube-nocookie.com/embed/abc123xxxxx',
      title: 'Test',
      thumbnailUrl: 'https://thumb.jpg',
    }
    vi.mocked(resolveYouTube).mockResolvedValue(mockMetadata)
    vi.mocked(resolveVimeo).mockResolvedValue(null)

    const result = await resolveEmbedUrl('https://youtube.com/watch?v=abc123xxxxx')

    expect(result).toEqual(mockMetadata)
  })

  it('should return Vimeo metadata when URL is a Vimeo URL', async () => {
    const mockMetadata = {
      provider: 'vimeo' as const,
      videoId: '123456789',
      embedUrl: 'https://player.vimeo.com/video/123456789',
      title: 'My Vimeo Video',
      thumbnailUrl: 'https://i.vimeocdn.com/video/123_1280x720.jpg',
    }
    vi.mocked(resolveYouTube).mockResolvedValue(null)
    vi.mocked(resolveVimeo).mockResolvedValue(mockMetadata)

    const result = await resolveEmbedUrl('https://vimeo.com/123456789')

    expect(result).toEqual(mockMetadata)
  })

  it('should return YouTube result without falling through to Vimeo when YouTube matches', async () => {
    const youtubeMetadata = {
      provider: 'youtube' as const,
      videoId: 'abc123xxxxx',
      embedUrl: 'https://www.youtube-nocookie.com/embed/abc123xxxxx',
      title: 'YouTube',
      thumbnailUrl: null,
    }
    vi.mocked(resolveYouTube).mockResolvedValue(youtubeMetadata)
    vi.mocked(resolveVimeo).mockResolvedValue(null)

    const result = await resolveEmbedUrl('https://youtube.com/watch?v=abc123xxxxx')

    expect(result).toEqual(youtubeMetadata)
    expect(result.provider).toBe('youtube')
  })

  it('should return generic metadata when no provider matches', async () => {
    vi.mocked(resolveYouTube).mockResolvedValue(null)
    vi.mocked(resolveVimeo).mockResolvedValue(null)

    const result = await resolveEmbedUrl('https://example.com/some-page')

    expect(result).toEqual({
      provider: 'generic',
      videoId: null,
      embedUrl: 'https://example.com/some-page',
      thumbnailUrl: null,
      title: null,
    })
  })
})
