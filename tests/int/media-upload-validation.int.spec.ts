/**
 * Integration tests: Media Upload Validation Hook
 * Covers: validateMediaUploadHook — MIME type allowlist + file size limits
 *
 * P0 — security: malicious files disguised as images could bypass validation.
 * Tests call the hook directly to avoid full Payload upload pipeline complexity.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { validateMediaUploadHook } from '@/server/payload/collections/Media/hooks/validateMediaUpload'
import { MediaType } from '@/infra/media/types'
import type { PayloadRequest } from 'payload'

/** Build a minimal fake PayloadRequest with optional file metadata */
function makeReq(opts: { hasFile?: boolean } = {}): PayloadRequest {
  return {
    file: opts.hasFile ? { name: 'test.jpg' } : undefined,
    payload: {} as any,
    headers: new Headers(),
  } as unknown as PayloadRequest
}

/** Build fake hook data */
function makeData(overrides: {
  type?: string
  mimeType?: string
  filename?: string
  filesize?: number
  externalUrl?: string
}) {
  return { ...overrides }
}

describe('validateMediaUploadHook', () => {
  describe('operation guard', () => {
    it('skips validation on update operations', async () => {
      // On update, hook should return data unchanged (no throws)
      const data = makeData({ mimeType: 'application/exe', filename: 'malware.exe', filesize: 999 })
      const result = await validateMediaUploadHook({
        data,
        operation: 'update',
        req: makeReq(),
        context: {},
      } as any)
      expect(result).toBe(data)
    })
  })

  describe('external media', () => {
    it('passes validation for external type with externalUrl', async () => {
      const data = makeData({ type: MediaType.External, externalUrl: 'https://example.com/v.mp4' })
      await expect(
        validateMediaUploadHook({ data, operation: 'create', req: makeReq(), context: {} } as any),
      ).resolves.not.toThrow()
    })

    it('throws when external type has no externalUrl', async () => {
      const data = makeData({ type: MediaType.External })
      await expect(
        validateMediaUploadHook({ data, operation: 'create', req: makeReq(), context: {} } as any),
      ).rejects.toThrow('External media requires an external URL')
    })
  })

  describe('file requirement', () => {
    it('throws when non-external media has no mimeType or filename', async () => {
      const data = makeData({ type: MediaType.Image })
      await expect(
        validateMediaUploadHook({ data, operation: 'create', req: makeReq(), context: {} } as any),
      ).rejects.toThrow('A file is required')
    })

    it('skips validation when req.file exists but data lacks metadata (client upload edge case)', async () => {
      const data = makeData({}) // no mimeType, no filename
      const result = await validateMediaUploadHook({
        data,
        operation: 'create',
        req: makeReq({ hasFile: true }),
        context: {},
      } as any)
      expect(result).toBe(data) // returned unchanged, no throw
    })
  })

  describe('MIME type allowlist', () => {
    it('accepts valid image MIME type', async () => {
      const data = makeData({
        type: MediaType.Image,
        mimeType: 'image/jpeg',
        filename: 'photo.jpg',
        filesize: 1024,
      })
      await expect(
        validateMediaUploadHook({ data, operation: 'create', req: makeReq(), context: {} } as any),
      ).resolves.not.toThrow()
    })

    it('downgrades type to "other" for invalid MIME type (does not throw)', async () => {
      const data = makeData({
        type: MediaType.Image,
        mimeType: 'application/octet-stream', // not in image allowlist
        filename: 'fake.jpg',
        filesize: 1024,
      })
      const result = await validateMediaUploadHook({
        data,
        operation: 'create',
        req: makeReq(),
        context: {},
      } as any)
      expect(result.type).toBe(MediaType.Other)
    })

    it('accepts valid PDF MIME type', async () => {
      const data = makeData({
        type: MediaType.PDF,
        mimeType: 'application/pdf',
        filename: 'doc.pdf',
        filesize: 1024,
      })
      await expect(
        validateMediaUploadHook({ data, operation: 'create', req: makeReq(), context: {} } as any),
      ).resolves.not.toThrow()
    })

    it('accepts valid audio MIME type', async () => {
      const data = makeData({
        type: MediaType.Audio,
        mimeType: 'audio/mpeg',
        filename: 'track.mp3',
        filesize: 1024,
      })
      await expect(
        validateMediaUploadHook({ data, operation: 'create', req: makeReq(), context: {} } as any),
      ).resolves.not.toThrow()
    })
  })

  describe('file size limits', () => {
    it('throws when image exceeds 10 MB', async () => {
      const elevenMB = 11 * 1024 * 1024
      const data = makeData({
        type: MediaType.Image,
        mimeType: 'image/jpeg',
        filename: 'huge.jpg',
        filesize: elevenMB,
      })
      await expect(
        validateMediaUploadHook({ data, operation: 'create', req: makeReq(), context: {} } as any),
      ).rejects.toThrow(/exceeds maximum/)
    })

    it('accepts image at exactly 10 MB', async () => {
      const tenMB = 10 * 1024 * 1024
      const data = makeData({
        type: MediaType.Image,
        mimeType: 'image/png',
        filename: 'ok.png',
        filesize: tenMB,
      })
      await expect(
        validateMediaUploadHook({ data, operation: 'create', req: makeReq(), context: {} } as any),
      ).resolves.not.toThrow()
    })

    it('throws when PDF exceeds 20 MB', async () => {
      const twentyOneMB = 21 * 1024 * 1024
      const data = makeData({
        type: MediaType.PDF,
        mimeType: 'application/pdf',
        filename: 'big.pdf',
        filesize: twentyOneMB,
      })
      await expect(
        validateMediaUploadHook({ data, operation: 'create', req: makeReq(), context: {} } as any),
      ).rejects.toThrow(/exceeds maximum/)
    })

    it('throws when video exceeds 100 MB', async () => {
      const hundredOneMB = 101 * 1024 * 1024
      const data = makeData({
        type: MediaType.Video,
        mimeType: 'video/mp4',
        filename: 'movie.mp4',
        filesize: hundredOneMB,
      })
      await expect(
        validateMediaUploadHook({ data, operation: 'create', req: makeReq(), context: {} } as any),
      ).rejects.toThrow(/exceeds maximum/)
    })

    it('accepts video within 100 MB limit', async () => {
      const fiftyMB = 50 * 1024 * 1024
      const data = makeData({
        type: MediaType.Video,
        mimeType: 'video/mp4',
        filename: 'clip.mp4',
        filesize: fiftyMB,
      })
      await expect(
        validateMediaUploadHook({ data, operation: 'create', req: makeReq(), context: {} } as any),
      ).resolves.not.toThrow()
    })

    it('throws when SVG exceeds 2 MB', async () => {
      const threeMB = 3 * 1024 * 1024
      const data = makeData({
        type: MediaType.SVG,
        mimeType: 'image/svg+xml',
        filename: 'icon.svg',
        filesize: threeMB,
      })
      await expect(
        validateMediaUploadHook({ data, operation: 'create', req: makeReq(), context: {} } as any),
      ).rejects.toThrow(/exceeds maximum/)
    })
  })
})
