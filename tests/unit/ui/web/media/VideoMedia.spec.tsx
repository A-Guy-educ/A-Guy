// @vitest-environment jsdom

/**
 * Unit Tests for VideoMedia Component
 *
 * Tests event listener cleanup behavior to verify memory leak prevention.
 */
import { cleanup } from '@testing-library/react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'

// Mock the cn utility to return a passthrough function
vi.mock('@/infra/utils/ui', () => ({
  cn: (...inputs: unknown[]) => inputs.filter(Boolean).join(' ') || undefined,
}))

// Mock getMediaUrl to return the input string
vi.mock('@/infra/utils/getMediaUrl', () => ({
  getMediaUrl: (url: string) => url,
}))

import { VideoMedia } from '@/ui/web/media/VideoMedia'

describe('VideoMedia', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Create fresh spies for each test
    addEventListenerSpy = vi.spyOn(HTMLVideoElement.prototype, 'addEventListener')
    removeEventListenerSpy = vi.spyOn(HTMLVideoElement.prototype, 'removeEventListener')
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  describe('event listener cleanup', () => {
    it('should removeEventListener on unmount - Test 1: Event listener cleanup on unmount', () => {
      // Use type assertion to pass the required shape
      const testResource = {
        filename: 'test.mp4',
        id: '1',
        mimeType: 'video/mp4',
        url: '/media/test.mp4',
        createdAt: '',
        updatedAt: '',
      } as unknown as Parameters<typeof VideoMedia>[0]['resource']

      // Render the component
      const { unmount } = render(<VideoMedia resource={testResource} />)

      // Verify addEventListener was called with 'suspend'
      expect(addEventListenerSpy).toHaveBeenCalledWith('suspend', expect.any(Function))

      // Unmount the component
      unmount()

      // Verify removeEventListener was called with 'suspend' - this verifies the cleanup works
      expect(removeEventListenerSpy).toHaveBeenCalledWith('suspend', expect.any(Function))
    })

    it('should have explicit muted={true} attribute - Test 2: Explicit muted attribute', () => {
      // Use type assertion to pass the required shape
      const testResource = {
        filename: 'test.mp4',
        id: '1',
        mimeType: 'video/mp4',
        url: '/media/test.mp4',
        createdAt: '',
        updatedAt: '',
      } as unknown as Parameters<typeof VideoMedia>[0]['resource']

      const { container } = render(<VideoMedia resource={testResource} />)

      const videoElement = container.querySelector('video')

      // Check that muted is explicitly set to true
      // This test may pass even before fix due to React normalizing boolean attributes
      expect(videoElement).not.toBeNull()
      // Use the property instead of attribute for boolean properties
      expect(videoElement?.muted).toBe(true)
    })

    it('should not duplicate listeners on remount - Test 3: No duplicate listeners on remount', () => {
      // Use type assertion to pass the required shape
      const testResource = {
        filename: 'test.mp4',
        id: '1',
        mimeType: 'video/mp4',
        url: '/media/test.mp4',
        createdAt: '',
        updatedAt: '',
      } as unknown as Parameters<typeof VideoMedia>[0]['resource']

      // First mount - get initial counts
      const { unmount: unmount1 } = render(<VideoMedia resource={testResource} />)
      const initialAddCount = addEventListenerSpy.mock.calls.length
      const initialRemoveCount = removeEventListenerSpy.mock.calls.length

      // Unmount first time
      unmount1()
      const afterFirstUnmountAddCount = addEventListenerSpy.mock.calls.length
      const afterFirstUnmountRemoveCount = removeEventListenerSpy.mock.calls.length

      // Second mount
      const { unmount: unmount2 } = render(<VideoMedia resource={testResource} />)
      const afterSecondMountAddCount = addEventListenerSpy.mock.calls.length
      const afterSecondMountRemoveCount = removeEventListenerSpy.mock.calls.length

      // Unmount second time
      unmount2()
      const finalAddCount = addEventListenerSpy.mock.calls.length
      const finalRemoveCount = removeEventListenerSpy.mock.calls.length

      // Between first unmount and second mount, addEventListener should be called again (new listener)
      const listenersAddedBetweenUnmounts = afterSecondMountAddCount - afterFirstUnmountAddCount

      // Verify: We added a new listener on second mount
      expect(listenersAddedBetweenUnmounts).toBeGreaterThan(0)

      // After fix: cleanup IS happening between unmounts (removeEventListener called once on first unmount)
      const listenersRemovedBetweenUnmounts = afterFirstUnmountRemoveCount - initialRemoveCount
      expect(listenersRemovedBetweenUnmounts).toBe(1) // Cleanup happened on first unmount

      // After second unmount, verify removeEventListener was called 2 times total (once for each unmount)
      const totalRemoveCalls = finalRemoveCount - initialRemoveCount
      expect(totalRemoveCalls).toBe(2) // Should be 2: once for each unmount
    })
  })
})
