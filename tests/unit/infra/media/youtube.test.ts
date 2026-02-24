import { describe, it, expect } from 'vitest'

import { isYouTubeUrl, extractYouTubeVideoId, getYouTubeEmbedUrl } from '@/infra/media/youtube'

describe('YouTube URL utilities', () => {
  describe('isYouTubeUrl', () => {
    it.each([
      ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'standard watch'],
      ['https://youtube.com/watch?v=dQw4w9WgXcQ', 'without www'],
      ['http://www.youtube.com/watch?v=dQw4w9WgXcQ', 'http'],
      ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'mobile'],
      ['https://youtu.be/dQw4w9WgXcQ', 'short URL'],
      ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'embed URL'],
      ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'privacy-enhanced embed'],
      ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'shorts'],
      ['https://www.youtube.com/live/dQw4w9WgXcQ', 'live'],
      ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120', 'with timestamp'],
      [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
        'with playlist',
      ],
      ['https://youtu.be/dQw4w9WgXcQ?si=abc123', 'short with share param'],
    ])('should detect %s (%s)', (url) => {
      expect(isYouTubeUrl(url)).toBe(true)
    })

    it.each([
      ['https://www.google.com', 'Google'],
      ['https://vimeo.com/12345', 'Vimeo'],
      ['https://www.dailymotion.com/video/x12345', 'Dailymotion'],
      ['https://www.youtube.com/channel/UC12345', 'YouTube channel (no video)'],
      ['https://www.youtube.com/', 'YouTube homepage'],
      ['not-a-url', 'random string'],
      ['', 'empty string'],
    ])('should reject %s (%s)', (url) => {
      expect(isYouTubeUrl(url)).toBe(false)
    })
  })

  describe('extractYouTubeVideoId', () => {
    it.each([
      ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ', 'standard watch'],
      ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ', 'short URL'],
      ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ', 'embed'],
      ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ', 'shorts'],
      ['https://www.youtube.com/live/dQw4w9WgXcQ', 'dQw4w9WgXcQ', 'live'],
      ['https://www.youtube.com/watch?v=Ab_Cd-Ef_12', 'Ab_Cd-Ef_12', 'hyphens and underscores'],
      [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120&list=PLtest',
        'dQw4w9WgXcQ',
        'with extra params',
      ],
      ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ', 'mobile'],
    ])('should extract %s from %s (%s)', (url, expectedId) => {
      expect(extractYouTubeVideoId(url)).toBe(expectedId)
    })

    it.each([
      ['https://www.google.com', 'non-YouTube'],
      ['https://vimeo.com/12345', 'Vimeo'],
      ['', 'empty string'],
    ])('should return null for %s (%s)', (url) => {
      expect(extractYouTubeVideoId(url)).toBeNull()
    })
  })

  describe('getYouTubeEmbedUrl', () => {
    it('should return privacy-enhanced embed URL for YouTube', () => {
      expect(getYouTubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      )
    })

    it('should return privacy-enhanced embed URL for short URL', () => {
      expect(getYouTubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      )
    })

    it('should return null for non-YouTube URL', () => {
      expect(getYouTubeEmbedUrl('https://www.google.com')).toBeNull()
    })

    it('should return null for empty string', () => {
      expect(getYouTubeEmbedUrl('')).toBeNull()
    })
  })
})
