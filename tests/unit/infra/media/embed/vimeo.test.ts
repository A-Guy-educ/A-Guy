import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isVimeoUrl,
  extractVimeoVideoId,
  buildVimeoEmbedUrl,
  fetchVimeoMetadata,
  resolveVimeo,
} from '@/infra/media/embed/vimeo'

describe('Vimeo embed utilities', () => {
  // ----------------------------------------------------------
  // isVimeoUrl
  // ----------------------------------------------------------
  describe('isVimeoUrl', () => {
    it('should detect standard vimeo.com URL', () => {
      expect(isVimeoUrl('https://vimeo.com/123456789')).toBe(true)
    })

    it('should detect www.vimeo.com URL', () => {
      expect(isVimeoUrl('https://www.vimeo.com/123456789')).toBe(true)
    })

    it('should detect player.vimeo.com URL', () => {
      expect(isVimeoUrl('https://player.vimeo.com/video/123456789')).toBe(true)
    })

    it('should detect channel URL', () => {
      expect(isVimeoUrl('https://vimeo.com/channels/mychannel/123456789')).toBe(true)
    })

    it('should detect group URL', () => {
      expect(isVimeoUrl('https://vimeo.com/groups/mygroup/videos/123456789')).toBe(true)
    })

    it('should detect URL without https://', () => {
      expect(isVimeoUrl('vimeo.com/123456789')).toBe(true)
    })

    it('should detect private video URL with hash', () => {
      expect(isVimeoUrl('https://vimeo.com/123456789?h=abc123')).toBe(true)
    })

    it('should reject non-Vimeo URLs', () => {
      expect(isVimeoUrl('https://youtube.com/watch?v=abc123xxxxx')).toBe(false)
      expect(isVimeoUrl('https://example.com')).toBe(false)
      expect(isVimeoUrl('')).toBe(false)
    })

    it('should reject Vimeo URLs without video ID', () => {
      expect(isVimeoUrl('https://vimeo.com')).toBe(false)
      expect(isVimeoUrl('https://vimeo.com/')).toBe(false)
    })
  })

  // ----------------------------------------------------------
  // extractVimeoVideoId
  // ----------------------------------------------------------
  describe('extractVimeoVideoId', () => {
    it('should extract ID from standard URL', () => {
      expect(extractVimeoVideoId('https://vimeo.com/123456789')).toBe('123456789')
    })

    it('should extract ID from player URL', () => {
      expect(extractVimeoVideoId('https://player.vimeo.com/video/123456789')).toBe('123456789')
    })

    it('should extract ID from channel URL', () => {
      expect(extractVimeoVideoId('https://vimeo.com/channels/mychannel/123456789')).toBe(
        '123456789',
      )
    })

    it('should extract ID from group URL', () => {
      expect(extractVimeoVideoId('https://vimeo.com/groups/mygroup/videos/123456789')).toBe(
        '123456789',
      )
    })

    it('should extract ID from private video URL with hash', () => {
      expect(extractVimeoVideoId('https://vimeo.com/123456789?h=abc123')).toBe('123456789')
    })

    it('should return null for non-Vimeo URL', () => {
      expect(extractVimeoVideoId('https://example.com')).toBe(null)
      expect(extractVimeoVideoId('')).toBe(null)
    })
  })

  // ----------------------------------------------------------
  // buildVimeoEmbedUrl
  // ----------------------------------------------------------
  describe('buildVimeoEmbedUrl', () => {
    it('should build standard embed URL', () => {
      expect(buildVimeoEmbedUrl('123456789')).toBe('https://player.vimeo.com/video/123456789')
    })

    it('should append private hash when provided', () => {
      expect(buildVimeoEmbedUrl('123456789', 'abc123')).toBe(
        'https://player.vimeo.com/video/123456789?h=abc123',
      )
    })

    it('should not append hash when null', () => {
      expect(buildVimeoEmbedUrl('123456789', null)).toBe('https://player.vimeo.com/video/123456789')
    })
  })

  // ----------------------------------------------------------
  // fetchVimeoMetadata
  // ----------------------------------------------------------
  describe('fetchVimeoMetadata', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn())
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should return metadata with title and thumbnail on success', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          title: 'My Vimeo Video',
          thumbnail_url: 'https://i.vimeocdn.com/video/123_1280x720.jpg',
          author_name: 'Test Author',
          author_url: 'https://vimeo.com/testauthor',
          html: '<iframe .../>',
        }),
      } as Response)

      const result = await fetchVimeoMetadata('123456789')

      expect(result).toEqual({
        provider: 'vimeo',
        videoId: '123456789',
        embedUrl: 'https://player.vimeo.com/video/123456789',
        title: 'My Vimeo Video',
        thumbnailUrl: 'https://i.vimeocdn.com/video/123_1280x720.jpg',
      })
    })

    it('should return metadata without title/thumbnail on oEmbed failure', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 403,
      } as Response)

      const result = await fetchVimeoMetadata('123456789')

      expect(result).toEqual({
        provider: 'vimeo',
        videoId: '123456789',
        embedUrl: 'https://player.vimeo.com/video/123456789',
        title: null,
        thumbnailUrl: null,
      })
    })

    it('should return metadata without title/thumbnail on network error', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      const result = await fetchVimeoMetadata('123456789')

      expect(result).toEqual({
        provider: 'vimeo',
        videoId: '123456789',
        embedUrl: 'https://player.vimeo.com/video/123456789',
        title: null,
        thumbnailUrl: null,
      })
    })

    it('should include private hash in embed URL when provided', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 403,
      } as Response)

      const result = await fetchVimeoMetadata('123456789', 'secrethash')

      expect(result.embedUrl).toBe('https://player.vimeo.com/video/123456789?h=secrethash')
    })
  })

  // ----------------------------------------------------------
  // resolveVimeo
  // ----------------------------------------------------------
  describe('resolveVimeo', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn())
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should return null for non-Vimeo URL', async () => {
      const result = await resolveVimeo('https://youtube.com/watch?v=abc123xxxxx')
      expect(result).toBeNull()
    })

    it('should return null for empty string', async () => {
      const result = await resolveVimeo('')
      expect(result).toBeNull()
    })

    it('should return EmbedMetadata for valid Vimeo URL', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          title: 'My Vimeo Video',
          thumbnail_url: 'https://i.vimeocdn.com/video/123_1280x720.jpg',
          author_name: 'Test',
          author_url: 'https://vimeo.com/test',
          html: '<iframe/>',
        }),
      } as Response)

      const result = await resolveVimeo('https://vimeo.com/123456789')

      expect(result).toEqual({
        provider: 'vimeo',
        videoId: '123456789',
        embedUrl: 'https://player.vimeo.com/video/123456789',
        title: 'My Vimeo Video',
        thumbnailUrl: 'https://i.vimeocdn.com/video/123_1280x720.jpg',
      })
    })

    it('should extract private hash from URL and pass it to embed URL', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 403,
      } as Response)

      const result = await resolveVimeo('https://vimeo.com/123456789?h=secrethash')

      expect(result?.embedUrl).toBe('https://player.vimeo.com/video/123456789?h=secrethash')
      expect(result?.videoId).toBe('123456789')
    })
  })
})
