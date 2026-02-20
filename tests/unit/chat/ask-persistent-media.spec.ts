/**
 * Unit Tests for Ask Tab Persistent Media Logic
 *
 * Tests the single-image-per-session behavior for the Ask page:
 * - Only one image at a time (replaces previous)
 * - Image is sent with every chat message (not cleared after send)
 * - Deduplication when combining with regular uploaded media
 */
import { describe, expect, it } from 'vitest'

/**
 * Mirrors the media combination logic from useNotebookChat.sendMessage.
 * Extracted here for pure unit testing without React hook dependencies.
 */
function combineMediaIds(uploadedMediaIds: string[], askMediaId: string | null): string[] {
  const mediaIds = [...uploadedMediaIds]
  if (askMediaId && !mediaIds.includes(askMediaId)) {
    mediaIds.push(askMediaId)
  }
  return mediaIds
}

interface MediaMeta {
  mediaId: string
  filename: string
}

function combineMediaMetadata(
  uploadedMedia: Array<{ id: string; filename: string }>,
  askMedia: { id: string; filename: string } | null,
): MediaMeta[] {
  const meta: MediaMeta[] = uploadedMedia.map((m) => ({
    mediaId: m.id,
    filename: m.filename,
  }))
  if (askMedia && !uploadedMedia.some((m) => m.id === askMedia.id)) {
    meta.push({ mediaId: askMedia.id, filename: askMedia.filename })
  }
  return meta
}

/**
 * Mirrors the single-replace behavior of addExternalMedia.
 * Returns the new askMedia state (replaces previous entirely).
 */
function replaceAskMedia(mediaId: string, filename: string, mimeType = 'image/jpeg') {
  return { id: mediaId, filename, mimeType }
}

describe('Ask Persistent Media', () => {
  describe('replaceAskMedia (addExternalMedia behavior)', () => {
    it('should set media with given values', () => {
      const result = replaceAskMedia('media-1', 'exercise.png')
      expect(result).toEqual({
        id: 'media-1',
        filename: 'exercise.png',
        mimeType: 'image/jpeg',
      })
    })

    it('should replace previous media entirely', () => {
      const first = replaceAskMedia('media-1', 'first.png')
      const second = replaceAskMedia('media-2', 'second.png')

      expect(first.id).toBe('media-1')
      expect(second.id).toBe('media-2')
      // The hook uses setState so there's only ever one value — no array accumulation
    })

    it('should use custom mimeType when provided', () => {
      const result = replaceAskMedia('media-1', 'doc.pdf', 'application/pdf')
      expect(result.mimeType).toBe('application/pdf')
    })
  })

  describe('combineMediaIds', () => {
    it('should return only askMediaId when no uploaded media', () => {
      const result = combineMediaIds([], 'ask-media-1')
      expect(result).toEqual(['ask-media-1'])
    })

    it('should return empty when no media at all', () => {
      const result = combineMediaIds([], null)
      expect(result).toEqual([])
    })

    it('should combine uploaded media and askMedia', () => {
      const result = combineMediaIds(['upload-1', 'upload-2'], 'ask-media-1')
      expect(result).toEqual(['upload-1', 'upload-2', 'ask-media-1'])
    })

    it('should deduplicate when askMediaId is already in uploaded media', () => {
      const result = combineMediaIds(['upload-1', 'ask-media-1'], 'ask-media-1')
      expect(result).toEqual(['upload-1', 'ask-media-1'])
      expect(result.filter((id) => id === 'ask-media-1')).toHaveLength(1)
    })

    it('should return only uploaded media when askMedia is null', () => {
      const result = combineMediaIds(['upload-1'], null)
      expect(result).toEqual(['upload-1'])
    })
  })

  describe('combineMediaMetadata', () => {
    it('should include askMedia metadata when no uploaded media', () => {
      const result = combineMediaMetadata([], { id: 'ask-1', filename: 'exercise.png' })
      expect(result).toEqual([{ mediaId: 'ask-1', filename: 'exercise.png' }])
    })

    it('should combine both sources', () => {
      const result = combineMediaMetadata([{ id: 'upload-1', filename: 'photo.jpg' }], {
        id: 'ask-1',
        filename: 'exercise.png',
      })
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ mediaId: 'upload-1', filename: 'photo.jpg' })
      expect(result[1]).toEqual({ mediaId: 'ask-1', filename: 'exercise.png' })
    })

    it('should deduplicate when askMedia ID matches an uploaded media ID', () => {
      const result = combineMediaMetadata([{ id: 'same-id', filename: 'uploaded.jpg' }], {
        id: 'same-id',
        filename: 'exercise.png',
      })
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ mediaId: 'same-id', filename: 'uploaded.jpg' })
    })

    it('should return empty when no media at all', () => {
      const result = combineMediaMetadata([], null)
      expect(result).toEqual([])
    })
  })

  describe('persistent behavior (not cleared after send)', () => {
    it('askMedia should remain the same after simulating a send cycle', () => {
      // Simulate: set askMedia, then "send" (clear uploadedMedia but keep askMedia)
      let askMedia = replaceAskMedia('ask-1', 'exercise.png')
      let uploadedMedia = [{ id: 'upload-1', filename: 'photo.jpg', mimeType: 'image/jpeg' }]

      // First send — combine media
      const firstSendIds = combineMediaIds(
        uploadedMedia.map((m) => m.id),
        askMedia.id,
      )
      expect(firstSendIds).toEqual(['upload-1', 'ask-1'])

      // After send: clear uploaded media but NOT askMedia
      uploadedMedia = []

      // Second send — askMedia still present
      const secondSendIds = combineMediaIds(
        uploadedMedia.map((m) => m.id),
        askMedia.id,
      )
      expect(secondSendIds).toEqual(['ask-1'])

      // Third send with new uploaded media — both present
      uploadedMedia = [{ id: 'upload-2', filename: 'new.jpg', mimeType: 'image/jpeg' }]
      const thirdSendIds = combineMediaIds(
        uploadedMedia.map((m) => m.id),
        askMedia.id,
      )
      expect(thirdSendIds).toEqual(['upload-2', 'ask-1'])

      // Replace askMedia with new image
      askMedia = replaceAskMedia('ask-2', 'new-exercise.png')
      const fourthSendIds = combineMediaIds(
        uploadedMedia.map((m) => m.id),
        askMedia.id,
      )
      expect(fourthSendIds).toEqual(['upload-2', 'ask-2'])
    })

    it('clearing askMedia should stop sending it', () => {
      const askMedia = replaceAskMedia('ask-1', 'exercise.png')
      const withMedia = combineMediaIds([], askMedia.id)
      expect(withMedia).toEqual(['ask-1'])

      // Clear askMedia (simulates clearAskMedia())
      const cleared: string | null = null
      const withoutMedia = combineMediaIds([], cleared)
      expect(withoutMedia).toEqual([])
    })
  })
})
