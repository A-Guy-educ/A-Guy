// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// Mock useHeaderTheme before importing HighImpactHero
const mockSetHeaderTheme = vi.fn()
vi.mock('@/ui/web/providers/HeaderTheme', () => ({
  useHeaderTheme: () => ({
    headerTheme: 'light',
    setHeaderTheme: mockSetHeaderTheme,
  }),
}))

// Mock CMSLink component
vi.mock('@/ui/web/Link', () => ({
  CMSLink: ({ href, label }: { href?: string; label?: string }) => (
    <a href={href} data-testid="cms-link-mock">
      {label || 'Link'}
    </a>
  ),
}))

// Mock RichText component
vi.mock('@/ui/web/RichText', () => ({
  __esModule: true,
  default: ({ data, className }: { data?: unknown; className?: string }) => (
    <div data-testid="richtext-mock" className={className}>
      RichText Mock
    </div>
  ),
}))

import { HighImpactHero } from '@/ui/web/heros/HighImpact'

// Create mock props - using type assertion to avoid complex Payload type issues
const createMockProps = (overrides?: {
  links?: Array<{ link: { label: string; url: string; type: string } }> | undefined
}) => {
  const defaultLinks = [
    {
      link: {
        label: 'Get Started',
        url: '/get-started',
        type: 'custom',
      },
    },
    {
      link: {
        label: 'Learn More',
        url: '/about',
        type: 'custom',
      },
    },
  ]
  const props = {
    type: 'highImpact' as const,
    richText: [
      {
        root: {
          type: 'root',
          children: [],
          direction: 'ltr' as const,
          format: '' as const,
          indent: 0,
          version: 1,
        },
      },
    ],
    links: overrides?.links === undefined ? defaultLinks : overrides.links,
  }
  return props as unknown as React.ComponentProps<typeof HighImpactHero>
}

describe('HighImpactHero', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('should call setHeaderTheme only once on mount, not on every render', () => {
    const mockProps = createMockProps()

    // Render the component twice to trigger a re-render
    const { rerender } = render(<HighImpactHero {...mockProps} />)

    // First render - setHeaderTheme should be called once
    expect(mockSetHeaderTheme).toHaveBeenCalledTimes(1)
    expect(mockSetHeaderTheme).toHaveBeenCalledWith('dark')

    // Rerender with the same props - this should NOT trigger setHeaderTheme again
    rerender(<HighImpactHero {...mockProps} />)

    // After rerender, setHeaderTheme should still only have been called once
    // This test will FAIL if useEffect lacks dependency array (current bug)
    expect(mockSetHeaderTheme).toHaveBeenCalledTimes(1)
  })

  it('should render rich text content', () => {
    const mockProps = createMockProps()
    const { getByTestId } = render(<HighImpactHero {...mockProps} />)

    const richTextMock = getByTestId('richtext-mock')
    expect(richTextMock).toBeTruthy()
  })

  it('should render links when provided', () => {
    const mockProps = createMockProps()
    const { getAllByTestId } = render(<HighImpactHero {...mockProps} />)

    const links = getAllByTestId('cms-link-mock')
    expect(links).toHaveLength(2)
    expect(links[0].textContent).toBe('Get Started')
    expect(links[1].textContent).toBe('Learn More')
  })

  it('should not render links when links array is empty', () => {
    const propsWithoutLinks = createMockProps({ links: [] })

    const { queryByTestId } = render(<HighImpactHero {...propsWithoutLinks} />)

    expect(queryByTestId('cms-link-mock')).toBeNull()
  })
})
