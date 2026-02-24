import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isYouTubeUrl,
  extractYouTubeVideoId,
  buildYouTubeEmbedUrl,
  fetchYouTubeMetadata,
  resolveYouTube,
} from '@/infra/media/embed/youtube'

describe('YouTube embed utilities', () => {
  // ----------------------------------------------------------
  // isYouTubeUrl
  // ----------------------------------------------------------
  describe('isYouTubeUrl', () => {
    it('should detect standard youtube.com/watch URL', () => {
      expect(isYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
    })

    it('should detect youtu.be short URL', () => {
      expect(isYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
    })

    it('should detect youtube.com/embed URL', () => {
      expect(isYouTubeUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(true)
    })

    it('should detect youtube.com/shorts URL', () => {
      expect(isYouTubeUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(true)
    })

    it('should detect youtube.com/live URL', () => {
      expect(isYouTubeUrl('https://www.youtube.com/live/dQw4w9WgXcQ')).toBe(true)
    })

    it('should detect mobile m.youtube.com URL', () => {
      expect(isYouTubeUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
    })

    it('should detect URL without https://', () => {
      expect(isYouTubeUrl('youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
    })

    it('should detect URL without www', () => {
      expect(isYouTubeUrl('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
    })

    it('should reject non-YouTube URLs', () => {
      expect(isYouTubeUrl('https://vimeo.com/123456')).toBe(false)
      expect(isYouTubeUrl('https://example.com')).toBe(false)
      expect(isYouTubeUrl('')).toBe(false)
    })

    it('should reject YouTube URLs without video ID', () => {
      expect(isYouTubeUrl('https://www.youtube.com')).toBe(false)
      expect(isYouTubeUrl('https://www.youtube.com/watch')).toBe(false)
    })

    it('should handle URL with extra query parameters', () => {
      expect(isYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s')).toBe(true)
      expect(isYouTubeUrl('https://www.youtube.com/watch?list=PLxxx&v=dQw4w9WgXcQ')).toBe(true)
    })
  })

  // ----------------------------------------------------------
  // extractYouTubeVideoId
  // ----------------------------------------------------------
  describe('extractYouTubeVideoId', () => {
    it('should extract ID from standard watch URL', () => {
      expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ',
      )
    })

    it('should extract ID from short URL', () => {
      expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    })

    it('should extract ID from embed URL', () => {
      expect(extractYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    })

    it('should extract ID from shorts URL', () => {
      expect(extractYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ',
      )
    })

    it('should extract ID with extra query params', () => {
      expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120')).toBe(
        'dQw4w9WgXcQ',
      )
    })

    it('should return null for non-YouTube URL', () => {
      expect(extractYouTubeVideoId('https://vimeo.com/123456')).toBeNull()
    })

    it('should return null for empty string', () => {
      expect(extractYouTubeVideoId('')).toBeNull()
    })

    it('should handle IDs with hyphens and underscores', () => {
      expect(extractYouTubeVideoId('https://youtu.be/abc-def_123')).toBe('abc-def_123')
    })
  })

  // ----------------------------------------------------------
  // buildYouTubeEmbedUrl
  // ----------------------------------------------------------
  describe('buildYouTubeEmbedUrl', () => {
    it('should build privacy-enhanced embed URL', () => {
      expect(buildYouTubeEmbedUrl('dQw4w9WgXcQ')).toBe(
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      )
    })
  })

  // ----------------------------------------------------------
  // fetchYouTubeMetadata (mocked fetch)
  // ----------------------------------------------------------
  describe('fetchYouTubeMetadata', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn())
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should return full metadata on successful oEmbed response', async () => {
      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            title: 'Test Video Title',
            author_name: 'Test Author',
            author_url: 'https://www.youtube.com/@testauthor',
            thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
            thumbnail_width: 480,
            thumbnail_height: 360,
            html: '<iframe ...></iframe>',
          }),
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response)

      const result = await fetchYouTubeMetadata('dQw4w9WgXcQ')

      expect(result).toEqual({
        provider: 'youtube',
        videoId: 'dQw4w9WgXcQ',
        embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        title: 'Test Video Title',
        thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      })

      // Verify fetch was called with correct oEmbed URL
      expect(fetch).toHaveBeenCalledWith(
        'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ&format=json',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
    })

    it('should return metadata without title/thumbnail on non-OK response', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: false } as Response)

      const result = await fetchYouTubeMetadata('dQw4w9WgXcQ')

      expect(result.provider).toBe('youtube')
      expect(result.videoId).toBe('dQw4w9WgXcQ')
      expect(result.embedUrl).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
      expect(result.title).toBeNull()
      expect(result.thumbnailUrl).toBeNull()
    })

    it('should return metadata without title/thumbnail on network error', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      const result = await fetchYouTubeMetadata('dQw4w9WgXcQ')

      expect(result.provider).toBe('youtube')
      expect(result.videoId).toBe('dQw4w9WgXcQ')
      expect(result.embedUrl).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
      expect(result.title).toBeNull()
      expect(result.thumbnailUrl).toBeNull()
    })
  })

  // ----------------------------------------------------------
  // resolveYouTube (integration of the above)
  // ----------------------------------------------------------
  describe('resolveYouTube', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn())
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should return null for non-YouTube URLs', async () => {
      const result = await resolveYouTube('https://vimeo.com/123456')
      expect(result).toBeNull()
    })

    it('should resolve a YouTube URL to full metadata', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ title: 'My Video', thumbnail_url: 'https://thumb.jpg' }),
      } as Response)

      const result = await resolveYouTube('https://www.youtube.com/watch?v=dQw4w9WgXcQ')

      expect(result).not.toBeNull()
      expect(result!.provider).toBe('youtube')
      expect(result!.videoId).toBe('dQw4w9WgXcQ')
      expect(result!.title).toBe('My Video')
    })
  })
})
