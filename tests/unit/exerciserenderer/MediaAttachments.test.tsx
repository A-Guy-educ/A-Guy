// @vitest-environment jsdom
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MediaAttachments } from '@/ui/web/exerciserenderer/components/MediaAttachments'
import { MediaMapProvider } from '@/ui/web/exerciserenderer/context/MediaMapContext'
import type { Media } from '@/payload-types'

function createMedia(overrides: Partial<Media> & { id: string }): Media {
  return {
    filename: 'test.png',
    url: '/media/test.png',
    alt: '',
    mimeType: 'image/png',
    type: 'image',
    filesize: 1000,
    width: 100,
    height: 100,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    retentionPolicy: 'persistent',
    ...overrides,
  } as Media
}

function renderWithMediaMap(ui: React.ReactElement, mediaMap: Record<string, Media>) {
  return render(<MediaMapProvider value={mediaMap}>{ui}</MediaMapProvider>)
}

describe('MediaAttachments', () => {
  it('renders nothing when mediaIds is undefined', () => {
    const { container } = renderWithMediaMap(<MediaAttachments mediaIds={undefined} />, {})
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when mediaIds is empty', () => {
    const { container } = renderWithMediaMap(<MediaAttachments mediaIds={[]} />, {})
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when media IDs are not in the map', () => {
    const { container } = renderWithMediaMap(<MediaAttachments mediaIds={['nonexistent']} />, {})
    expect(container.innerHTML).toBe('')
  })

  it('renders an image for image type media', () => {
    const media = createMedia({
      id: 'img1',
      type: 'image',
      url: '/media/photo.png',
      alt: 'A photo',
    })

    renderWithMediaMap(<MediaAttachments mediaIds={['img1']} />, { img1: media })

    const img = screen.getByAltText('A photo')
    expect(img).toBeTruthy()
    expect(img.tagName).toBe('IMG')
  })

  it('renders an image for svg type media', () => {
    const media = createMedia({
      id: 'svg1',
      type: 'svg',
      url: '/media/diagram.svg',
      alt: 'A diagram',
      mimeType: 'image/svg+xml',
    })

    renderWithMediaMap(<MediaAttachments mediaIds={['svg1']} />, { svg1: media })

    const img = screen.getByAltText('A diagram')
    expect(img).toBeTruthy()
    expect(img.tagName).toBe('IMG')
  })

  it('renders a video element for video type media', () => {
    const media = createMedia({
      id: 'vid1',
      type: 'video',
      url: '/media/clip.mp4',
      mimeType: 'video/mp4',
    })

    const { container } = renderWithMediaMap(<MediaAttachments mediaIds={['vid1']} />, {
      vid1: media,
    })

    const video = container.querySelector('video')
    expect(video).toBeTruthy()
    expect(video?.getAttribute('controls')).not.toBeNull()

    const source = container.querySelector('source')
    expect(source?.getAttribute('type')).toBe('video/mp4')
  })

  it('renders multiple media items', () => {
    const img = createMedia({ id: 'img1', type: 'image', url: '/media/a.png', alt: 'Image A' })
    const svg = createMedia({ id: 'svg1', type: 'svg', url: '/media/b.svg', alt: 'SVG B' })

    renderWithMediaMap(<MediaAttachments mediaIds={['img1', 'svg1']} />, { img1: img, svg1: svg })

    expect(screen.getByAltText('Image A')).toBeTruthy()
    expect(screen.getByAltText('SVG B')).toBeTruthy()
  })

  it('applies custom className', () => {
    const media = createMedia({ id: 'img1', type: 'image', url: '/media/a.png', alt: 'test' })

    const { container } = renderWithMediaMap(
      <MediaAttachments mediaIds={['img1']} className="custom-class" />,
      { img1: media },
    )

    const wrapper = container.firstElementChild
    expect(wrapper?.className).toContain('custom-class')
  })
})
