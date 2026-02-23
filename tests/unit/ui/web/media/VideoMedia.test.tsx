// @vitest-environment jsdom
import React from 'react'
import { render, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { VideoMedia } from '@/ui/web/media/VideoMedia'
import type { Media } from '@/payload-types'

// Mock getMediaUrl
vi.mock('@/infra/utils/getMediaUrl', () => ({
  getMediaUrl: (path: string) => path,
}))

function createVideoMedia(): Media {
  return {
    id: 'video1',
    filename: 'test-video.mp4',
    url: '/media/test-video.mp4',
    alt: '',
    mimeType: 'video/mp4',
    type: 'video',
    filesize: 5000000,
    width: 1920,
    height: 1080,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    retentionPolicy: 'persistent',
  } as Media
}

describe('VideoMedia', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Spy on addEventListener and removeEventListener
    addEventListenerSpy = vi.spyOn(HTMLVideoElement.prototype, 'addEventListener')
    removeEventListenerSpy = vi.spyOn(HTMLVideoElement.prototype, 'removeEventListener')
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders a video element with correct attributes', () => {
    const media = createVideoMedia()
    const { container } = render(<VideoMedia resource={media} />)

    const video = container.querySelector('video')
    expect(video).toBeTruthy()
    expect(video?.hasAttribute('autoplay')).toBe(true)
    expect(video?.hasAttribute('loop')).toBe(true)
    // React sets muted as a DOM property, check both attribute and property
    expect(video?.muted).toBe(true)
    expect(video?.hasAttribute('playsinline')).toBe(true)
    expect(video?.getAttribute('controls')).toBe('false')

    const source = container.querySelector('source')
    expect(source?.getAttribute('src')).toBe('/media/test-video.mp4')
  })

  it('adds a suspend event listener on mount', () => {
    const media = createVideoMedia()
    render(<VideoMedia resource={media} />)

    expect(addEventListenerSpy).toHaveBeenCalledWith('suspend', expect.any(Function))
  })

  it('removes the suspend event listener on unmount', () => {
    const media = createVideoMedia()
    const { unmount } = render(<VideoMedia resource={media} />)

    // Get the handler function that was added
    const addListenerCalls = addEventListenerSpy.mock.calls.filter(
      (call: any[]) => call[0] === 'suspend',
    )
    expect(addListenerCalls.length).toBeGreaterThan(0)
    const handler = addListenerCalls[0][1]

    // Unmount the component
    unmount()

    // Verify removeEventListener was called with the same handler
    expect(removeEventListenerSpy).toHaveBeenCalledWith('suspend', handler)
  })

  it('does not add event listener when video ref is not available', () => {
    // Render with a resource that's not an object (edge case)
    render(<VideoMedia resource={undefined} />)

    // Should not have added any event listeners
    expect(addEventListenerSpy).not.toHaveBeenCalled()
  })

  it('cleans up event listeners on re-render navigation', () => {
    const media = createVideoMedia()

    // First render
    const { unmount: unmount1 } = render(<VideoMedia resource={media} />)
    const firstAddCount = addEventListenerSpy.mock.calls.filter(
      (call: any[]) => call[0] === 'suspend',
    ).length
    unmount1()
    const firstRemoveCount = removeEventListenerSpy.mock.calls.filter(
      (call: any[]) => call[0] === 'suspend',
    ).length

    // Second render (simulating navigation)
    const { unmount: unmount2 } = render(<VideoMedia resource={media} />)
    const secondAddCount =
      addEventListenerSpy.mock.calls.filter((call: any[]) => call[0] === 'suspend').length -
      firstAddCount
    unmount2()
    const secondRemoveCount =
      removeEventListenerSpy.mock.calls.filter((call: any[]) => call[0] === 'suspend').length -
      firstRemoveCount

    // Should have equal adds and removes to prevent memory leaks
    expect(firstAddCount).toBe(firstRemoveCount)
    expect(secondAddCount).toBeGreaterThanOrEqual(1)
    expect(
      removeEventListenerSpy.mock.calls.filter((call: any[]) => call[0] === 'suspend').length,
    ).toBeGreaterThanOrEqual(2)
  })

  it('applies custom videoClassName', () => {
    const media = createVideoMedia()
    const { container } = render(<VideoMedia resource={media} videoClassName="custom-video" />)

    const video = container.querySelector('video')
    expect(video?.className).toContain('custom-video')
  })

  it('handles onClick prop', () => {
    const media = createVideoMedia()
    const handleClick = vi.fn()
    const { container } = render(<VideoMedia resource={media} onClick={handleClick} />)

    const video = container.querySelector('video')
    video?.click()

    expect(handleClick).toHaveBeenCalled()
  })

  it('returns null when resource is not an object', () => {
    const { container } = render(<VideoMedia resource={null as any} />)
    expect(container.innerHTML).toBe('')
  })
})
