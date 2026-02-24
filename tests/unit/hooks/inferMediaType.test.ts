import { describe, it, expect, vi } from 'vitest'

import { MediaType } from '@/infra/media/types'
import { inferMediaTypeHook } from '@/server/payload/collections/Media/hooks/inferMediaType'

// Helper to create a mock Payload req
function createMockReq(user?: Record<string, unknown>) {
  return {
    user: user ?? null,
    payload: {
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    },
  } as unknown as Parameters<typeof inferMediaTypeHook>[0]['req']
}

// Helper to call the hook with minimal args
function callHook({
  data = {},
  operation = 'create',
  value,
  user,
}: {
  data?: Record<string, unknown>
  operation?: string
  value?: string
  user?: Record<string, unknown>
}) {
  return inferMediaTypeHook({
    data,
    operation,
    value,
    req: createMockReq(user),
    field: {} as unknown as Parameters<typeof inferMediaTypeHook>[0]['field'],
    collection: {} as unknown as Parameters<typeof inferMediaTypeHook>[0]['collection'],
    context: {},
    blockData: undefined,
    fullData: data,
    fullOriginalDoc: undefined,
    indexPath: '',
    overrideAccess: false,
    path: '' as unknown as Parameters<typeof inferMediaTypeHook>[0]['path'],
    previousDoc: undefined,
    previousSiblingDoc: undefined,
    previousValue: undefined,
    schemaPath: '' as unknown as Parameters<typeof inferMediaTypeHook>[0]['schemaPath'],
    siblingData: data,
    siblingDocWithLocales: undefined,
    siblingFields: [],
    originalDoc: undefined,
  } as unknown as Parameters<typeof inferMediaTypeHook>[0])
}

describe('inferMediaTypeHook', () => {
  describe('External type preservation', () => {
    it('should preserve External type when user selects it (no file)', () => {
      const result = callHook({
        data: {},
        value: MediaType.External,
        operation: 'create',
      })

      expect(result).toBe(MediaType.External)
    })

    it('should preserve External type on update', () => {
      const result = callHook({
        data: {},
        value: MediaType.External,
        operation: 'update',
      })

      expect(result).toBe(MediaType.External)
    })

    it('should preserve External type even when non-admin user', () => {
      const result = callHook({
        data: {},
        value: MediaType.External,
        operation: 'create',
        user: { id: '1', role: 'student', collection: 'users' },
      })

      expect(result).toBe(MediaType.External)
    })
  })

  describe('auto-inference from MIME type', () => {
    it('should infer Image from image/jpeg MIME type', () => {
      const result = callHook({
        data: { mimeType: 'image/jpeg', filename: 'photo.jpg' },
        operation: 'create',
      })

      expect(result).toBe(MediaType.Image)
    })

    it('should infer Video from video/mp4 MIME type', () => {
      const result = callHook({
        data: { mimeType: 'video/mp4', filename: 'clip.mp4' },
        operation: 'create',
      })

      expect(result).toBe(MediaType.Video)
    })

    it('should infer PDF from application/pdf MIME type', () => {
      const result = callHook({
        data: { mimeType: 'application/pdf', filename: 'doc.pdf' },
        operation: 'create',
      })

      expect(result).toBe(MediaType.PDF)
    })

    it('should return Other for no MIME type and no file', () => {
      const result = callHook({
        data: {},
        operation: 'create',
      })

      expect(result).toBe(MediaType.Other)
    })

    it('should return Other and log warning for unrecognized MIME type', () => {
      const req = createMockReq()
      const result = inferMediaTypeHook({
        data: { mimeType: 'application/x-custom-bizarre' },
        operation: 'create',
        value: undefined,
        req,
        field: {} as unknown as Parameters<typeof inferMediaTypeHook>[0]['field'],
        collection: {} as unknown as Parameters<typeof inferMediaTypeHook>[0]['collection'],
        context: {},
      } as unknown as Parameters<typeof inferMediaTypeHook>[0])

      expect(result).toBe(MediaType.Other)
      expect(
        (req as unknown as { payload: { logger: { warn: ReturnType<typeof vi.fn> } } }).payload
          .logger.warn,
      ).toHaveBeenCalledWith(expect.stringContaining('Unrecognized MIME type'))
    })
  })

  describe('admin override on update', () => {
    const adminUser = { id: '1', role: 'admin', collection: 'users' }

    it('should allow admin to override type on update', () => {
      const result = callHook({
        data: { mimeType: 'image/jpeg' },
        value: MediaType.Video,
        operation: 'update',
        user: adminUser,
      })

      // Admin chose Video even though MIME is image — should be respected
      expect(result).toBe(MediaType.Video)
    })

    it('should log warning when admin override does not match MIME', () => {
      const req = createMockReq(adminUser)
      inferMediaTypeHook({
        data: { mimeType: 'image/jpeg' },
        operation: 'update',
        value: MediaType.Video,
        req,
        field: {} as unknown as Parameters<typeof inferMediaTypeHook>[0]['field'],
        collection: {} as unknown as Parameters<typeof inferMediaTypeHook>[0]['collection'],
        context: {},
      } as unknown as Parameters<typeof inferMediaTypeHook>[0])

      expect(
        (req as unknown as { payload: { logger: { warn: ReturnType<typeof vi.fn> } } }).payload
          .logger.warn,
      ).toHaveBeenCalledWith(
        expect.stringContaining("Admin override type 'video' doesn't match MIME 'image/jpeg'"),
      )
    })

    it('should NOT allow non-admin to override type on update', () => {
      const result = callHook({
        data: { mimeType: 'image/jpeg' },
        value: MediaType.Video,
        operation: 'update',
        user: { id: '1', role: 'student', collection: 'users' },
      })

      // Non-admin tried to set Video, but MIME is image — should infer Image
      expect(result).toBe(MediaType.Image)
    })
  })
})
