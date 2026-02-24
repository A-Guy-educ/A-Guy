// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import type { Post } from '@/payload-types'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// Mock useHeaderTheme before importing PostHero
const mockSetHeaderTheme = vi.fn()
vi.mock('@/ui/web/providers/HeaderTheme', () => ({
  useHeaderTheme: () => ({
    headerTheme: 'light',
    setHeaderTheme: mockSetHeaderTheme,
  }),
}))

// Mock Media component
vi.mock('@/ui/web/media', () => ({
  Media: ({ fill, className, imgClassName, priority, resource }: any) => (
    <div data-testid="media-mock" data-fill={fill} data-priority={priority}>
      Media Mock
    </div>
  ),
}))

import { PostHero } from '@/ui/web/heros/PostHero'

describe('PostHero', () => {
  const mockPost: Post = {
    id: 'post-123',
    title: 'Test Post Title',
    slug: 'test-post',
    heroImage: {
      id: 'media-123',
      url: '/test-image.jpg',
      filename: 'test-image.jpg',
      mimeType: 'image/jpeg',
      width: 1920,
      height: 1080,
    },
  } as Post

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('should call setHeaderTheme only once on mount, not on every render', () => {
    // Render the component twice to trigger a re-render
    const { rerender } = render(<PostHero post={mockPost} />)

    // First render - setHeaderTheme should be called once
    expect(mockSetHeaderTheme).toHaveBeenCalledTimes(1)
    expect(mockSetHeaderTheme).toHaveBeenCalledWith('dark')

    // Rerender with the same props - this should NOT trigger setHeaderTheme again
    rerender(<PostHero post={mockPost} />)

    // After rerender, setHeaderTheme should still only have been called once
    // This test will FAIL if useEffect lacks dependency array (current bug)
    expect(mockSetHeaderTheme).toHaveBeenCalledTimes(1)
  })

  it('should render post title', () => {
    const { container } = render(<PostHero post={mockPost} />)

    const title = container.querySelector('h1')
    expect(title).toBeTruthy()
    expect(title?.textContent).toBe('Test Post Title')
  })

  it('should render hero image when present', () => {
    const { getByTestId } = render(<PostHero post={mockPost} />)

    const mediaMock = getByTestId('media-mock')
    expect(mediaMock).toBeTruthy()
  })

  it('should render without hero image', () => {
    const postWithoutImage = {
      ...mockPost,
      heroImage: undefined,
    }

    const { container, queryByTestId } = render(<PostHero post={postWithoutImage} />)

    expect(queryByTestId('media-mock')).toBeNull()
    const title = container.querySelector('h1')
    expect(title?.textContent).toBe('Test Post Title')
  })
})
