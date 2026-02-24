// @vitest-environment jsdom
import { VideoMedia } from '@/ui/web/media/VideoMedia'
import type { Media as MediaType } from '@/payload-types'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Mock dependencies
vi.mock('@/infra/utils/ui', () => ({
  cn: vi.fn((...classes: string[]) => classes.filter(Boolean).join(' ')),
}))

vi.mock('@/infra/utils/getMediaUrl', () => ({
  getMediaUrl: vi.fn((path: string) => path),
}))

describe('VideoMedia component', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  // Test 1: muted attribute is explicitly set to true
  describe('muted attribute', () => {
    it('should have muted attribute explicitly set to true', () => {
      const mockMedia: MediaType = {
        id: 'test-id',
        tenant: 'test-tenant',
        type: 'video',
        retentionPolicy: 'persistent',
        updatedAt: '2024-01-01T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
        filename: 'test.mp4',
        url: '/media/test.mp4',
        mimeType: 'video/mp4',
      }

      const { container } = render(<VideoMedia resource={mockMedia} />)

      const videoElement = container.querySelector('video')
      expect(videoElement).toBeTruthy()
      expect(videoElement?.muted).toBe(true)
    })
  })

  // Test 2: suspend event listener is added and cleaned up on unmount
  describe('suspend event listener cleanup', () => {
    it('should add suspend event listener and clean it up on unmount', () => {
      const addEventListenerSpy = vi.spyOn(HTMLVideoElement.prototype, 'addEventListener')
      const removeEventListenerSpy = vi.spyOn(HTMLVideoElement.prototype, 'removeEventListener')

      const mockMedia: MediaType = {
        id: 'test-id',
        tenant: 'test-tenant',
        type: 'video',
        retentionPolicy: 'persistent',
        updatedAt: '2024-01-01T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
        filename: 'test.mp4',
        url: '/media/test.mp4',
        mimeType: 'video/mp4',
      }

      const { unmount } = render(<VideoMedia resource={mockMedia} />)

      // Verify addEventListener was called with 'suspend'
      expect(addEventListenerSpy).toHaveBeenCalled()
      const suspendCalls = addEventListenerSpy.mock.calls.filter((call) => call[0] === 'suspend')
      // React StrictMode may cause effect to run twice, so we check >= 1
      expect(suspendCalls.length).toBeGreaterThanOrEqual(1)

      // Get the LAST handler function that was passed to addEventListener (handles StrictMode)
      const suspendHandler = suspendCalls[suspendCalls.length - 1][1] as EventListener

      // Unmount the component
      unmount()

      // Verify removeEventListener was called with the same handler
      expect(removeEventListenerSpy).toHaveBeenCalledWith('suspend', suspendHandler)
    })

    it('should not accumulate event listeners on remount', () => {
      const addEventListenerSpy = vi.spyOn(HTMLVideoElement.prototype, 'addEventListener')
      const removeEventListenerSpy = vi.spyOn(HTMLVideoElement.prototype, 'removeEventListener')

      const mockMedia: MediaType = {
        id: 'test-id',
        tenant: 'test-tenant',
        type: 'video',
        retentionPolicy: 'persistent',
        updatedAt: '2024-01-01T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
        filename: 'test.mp4',
        url: '/media/test.mp4',
        mimeType: 'video/mp4',
      }

      // First render and unmount
      const { unmount: unmount1 } = render(<VideoMedia resource={mockMedia} />)
      const firstSuspendCalls = addEventListenerSpy.mock.calls.filter(
        (call) => call[0] === 'suspend',
      ).length
      unmount1()

      // Second render and unmount
      const { unmount: unmount2 } = render(<VideoMedia resource={mockMedia} />)
      const secondSuspendCalls = addEventListenerSpy.mock.calls.filter(
        (call) => call[0] === 'suspend',
      ).length
      unmount2()

      // The removeEventListener should be called after each unmount
      const removeSuspendCalls = removeEventListenerSpy.mock.calls.filter(
        (call) => call[0] === 'suspend',
      ).length
      expect(removeSuspendCalls).toBe(2)
      // Each mount should add exactly one 'suspend' listener (StrictMode may cause >= 1)
      expect(secondSuspendCalls - firstSuspendCalls).toBeGreaterThanOrEqual(1)
    })
  })
})
