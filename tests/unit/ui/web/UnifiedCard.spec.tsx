// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { CheckCircle } from 'lucide-react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { UnifiedCard } from '@/ui/web/components/UnifiedCard'

// Mock CheckCircle to verify it renders
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react')
  return {
    ...actual,
    CheckCircle: ({ className, ...props }: ComponentProps<typeof CheckCircle>) => (
      <svg data-testid="check-circle" className={className} {...props}>
        <circle cx="12" cy="12" r="10" />
        <path d="m9 11 3 3L22 4" />
      </svg>
    ),
  }
})

describe('UnifiedCard completion state', () => {
  it('does not render CheckCircle overlay when progress is 100', () => {
    render(<UnifiedCard title="Test Lesson" progress={100} />)
    expect(screen.queryByTestId('check-circle')).toBeNull()
  })

  it('renders 100% text when progress is 100', () => {
    render(<UnifiedCard title="Test Lesson" progress={100} />)
    expect(screen.getByText('100%')).toBeTruthy()
  })

  it('does not render CheckCircle when progress is less than 100', () => {
    render(<UnifiedCard title="Test Lesson" progress={99} />)
    expect(screen.queryByTestId('check-circle')).toBeNull()
  })

  it('does not render CheckCircle when progress is 0', () => {
    render(<UnifiedCard title="Test Lesson" progress={0} />)
    expect(screen.queryByTestId('check-circle')).toBeNull()
  })

  it('renders percentage text when progress is between 0 and 100', () => {
    render(<UnifiedCard title="Test Lesson" progress={75} />)
    expect(screen.getByText('75%')).toBeTruthy()
  })

  it('renders percentage text for 99% progress', () => {
    render(<UnifiedCard title="Test Lesson" progress={99} />)
    expect(screen.getByText('99%')).toBeTruthy()
  })

  it('renders title correctly', () => {
    render(<UnifiedCard title="My Test Lesson" progress={50} />)
    expect(screen.getByText('My Test Lesson')).toBeTruthy()
  })
})
