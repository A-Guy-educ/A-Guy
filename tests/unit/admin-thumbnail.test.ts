import { describe, it, expect } from 'vitest'

import { MediaType } from '@/infra/media/types'
import { isYouTubeUrl, extractYouTubeVideoId } from '@/infra/media/youtube'

describe('adminThumbnail logic (YouTube thumbnail generation)', () => {
  /**
   * This test file validates the thumbnail URL generation logic
   * that is used in the adminThumbnail function in Media/index.ts
   *
   * The actual adminThumbnail function is:
   *   adminThumbnail: ({ doc }) => {
   *     const docData = doc as { type?: string; externalUrl?: string; url?: string }
   *     if (docData.type === MediaType.External && docData.externalUrl && isYouTubeUrl(docData.externalUrl)) {
   *       const videoId = extractYouTubeVideoId(docData.externalUrl)
   *       if (videoId) {
   *         return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
   *       }
   *       return null
   *     }
   *     if (docData.type === MediaType.External) {
   *       return null
   *     }
   *     return docData.url || false
   *   }
   */

  describe('isYouTubeUrl', () => {
    it('should recognize standard YouTube watch URLs', () => {
      expect(isYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
      expect(isYouTubeUrl('http://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
      expect(isYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123')).toBe(true)
    })

    it('should recognize YouTube short URLs', () => {
      expect(isYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
      expect(isYouTubeUrl('http://youtu.be/dQw4w9WgXcQ')).toBe(true)
    })

    it('should recognize YouTube embed URLs', () => {
      expect(isYouTubeUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(true)
      expect(isYouTubeUrl('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe(true)
    })

    it('should recognize YouTube shorts URLs', () => {
      expect(isYouTubeUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(true)
    })

    it('should recognize YouTube live URLs', () => {
      expect(isYouTubeUrl('https://www.youtube.com/live/dQw4w9WgXcQ')).toBe(true)
    })

    it('should recognize mobile YouTube URLs', () => {
      expect(isYouTubeUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
    })

    it('should reject non-YouTube URLs', () => {
      expect(isYouTubeUrl('https://vimeo.com/123456789')).toBe(false)
      expect(isYouTubeUrl('https://example.com/video')).toBe(false)
      expect(isYouTubeUrl('')).toBe(false)
      expect(isYouTubeUrl('not-a-url')).toBe(false)
    })
  })

  describe('extractYouTubeVideoId', () => {
    it('should extract video ID from standard watch URL', () => {
      expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ',
      )
    })

    it('should extract video ID from short URL', () => {
      expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    })

    it('should extract video ID from embed URL', () => {
      expect(extractYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    })

    it('should extract video ID from shorts URL', () => {
      expect(extractYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ',
      )
    })

    it('should extract video ID from live URL', () => {
      expect(extractYouTubeVideoId('https://www.youtube.com/live/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    })

    it('should handle URLs with extra parameters', () => {
      expect(
        extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&index=1'),
      ).toBe('dQw4w9WgXcQ')
    })

    it('should return null for non-YouTube URLs', () => {
      expect(extractYouTubeVideoId('https://vimeo.com/123456789')).toBe(null)
      expect(extractYouTubeVideoId('https://example.com/video')).toBe(null)
      expect(extractYouTubeVideoId('')).toBe(null)
    })
  })

  describe('YouTube thumbnail URL generation', () => {
    it('should generate correct mqdefault thumbnail URL', () => {
      const videoId = extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      expect(videoId).toBe('dQw4w9WgXcQ')
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
      expect(thumbnailUrl).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg')
    })

    it('should generate correct thumbnail for shorts URL', () => {
      const videoId = extractYouTubeVideoId('https://www.youtube.com/shorts/abc123xyz99')
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
      expect(thumbnailUrl).toBe('https://img.youtube.com/vi/abc123xyz99/mqdefault.jpg')
    })
  })

  describe('adminThumbnail behavior simulation', () => {
    /**
     * Simulates the adminThumbnail function logic
     */
    function getAdminThumbnailUrl(doc: {
      type?: string
      externalUrl?: string | null
      url?: string | null
    }): string | null | false {
      const docData = doc as { type?: string; externalUrl?: string | null; url?: string | null }

      // YouTube External media: return YouTube thumbnail
      if (
        docData.type === MediaType.External &&
        docData.externalUrl &&
        isYouTubeUrl(docData.externalUrl)
      ) {
        const videoId = extractYouTubeVideoId(docData.externalUrl)
        if (videoId) {
          return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
        }
        return null
      }

      // Other External media: no thumbnail
      if (docData.type === MediaType.External) {
        return null
      }

      // Uploaded files: return the main URL (false to disable if url is undefined)
      return docData.url || false
    }

    it('should return YouTube thumbnail URL for YouTube External media', () => {
      const doc = {
        type: MediaType.External,
        externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        url: null,
      }
      expect(getAdminThumbnailUrl(doc)).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg')
    })

    it('should return null for non-YouTube External media', () => {
      const doc = {
        type: MediaType.External,
        externalUrl: 'https://vimeo.com/123456789',
        url: null,
      }
      expect(getAdminThumbnailUrl(doc)).toBe(null)
    })

    it('should return null for External media with no externalUrl', () => {
      const doc = {
        type: MediaType.External,
        externalUrl: null,
        url: null,
      }
      expect(getAdminThumbnailUrl(doc)).toBe(null)
    })

    it('should return url for uploaded image files', () => {
      const doc = {
        type: MediaType.Image,
        externalUrl: null,
        url: 'https://example.blob.vercel-storage.com/image.jpg',
      }
      expect(getAdminThumbnailUrl(doc)).toBe('https://example.blob.vercel-storage.com/image.jpg')
    })

    it('should return false for uploaded file with no URL', () => {
      const doc = {
        type: MediaType.Image,
        externalUrl: null,
        url: null,
      }
      expect(getAdminThumbnailUrl(doc)).toBe(false)
    })

    it('should handle YouTube shorts URL', () => {
      const doc = {
        type: MediaType.External,
        externalUrl: 'https://www.youtube.com/shorts/abc123xyz99',
        url: null,
      }
      expect(getAdminThumbnailUrl(doc)).toBe('https://img.youtube.com/vi/abc123xyz99/mqdefault.jpg')
    })

    it('should handle YouTube embed URL', () => {
      const doc = {
        type: MediaType.External,
        externalUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        url: null,
      }
      expect(getAdminThumbnailUrl(doc)).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg')
    })

    it('should handle youtu.be short URL', () => {
      const doc = {
        type: MediaType.External,
        externalUrl: 'https://youtu.be/dQw4w9WgXcQ',
        url: null,
      }
      expect(getAdminThumbnailUrl(doc)).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg')
    })
  })
})
