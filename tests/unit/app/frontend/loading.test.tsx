// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import Loading from '@/app/(frontend)/loading'

// Module-level captured calls array for prop verification
const capturedSpinnerCalls: Array<{ size?: string; className?: string }> = []

// Mock Spinner to render a div with role="status" and capture props
vi.mock('@/infra/loading/components/Spinner', () => ({
  Spinner: ({ size, className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) => {
    capturedSpinnerCalls.push({ size, className })
    return <div role="status">Loading</div>
  },
}))

describe('Loading Component', () => {
  beforeEach(() => {
    vi.resetModules()
    capturedSpinnerCalls.length = 0
  })

  afterEach(() => {
    cleanup()
  })

  it('should render a spinner with loading role', async () => {
    const { container } = render(<Loading />)

    // Assert: element with role="status" exists in the document
    const statusElement = container.querySelector('[role="status"]')
    expect(statusElement).toBeTruthy()
    expect(statusElement?.textContent).toBe('Loading')

    // Assert: container has a div with expected classes
    const containerDiv = container.firstElementChild
    expect(containerDiv?.className).toContain('flex')
    expect(containerDiv?.className).toContain('items-center')
    expect(containerDiv?.className).toContain('justify-center')
    expect(containerDiv?.className).toContain('min-h-[50vh]')
  })

  it('should pass size="lg" and className="text-primary" to Spinner', async () => {
    render(<Loading />)

    // Assert: Spinner was called at least once
    expect(capturedSpinnerCalls.length).toBeGreaterThan(0)

    // Assert: Spinner was called with size='lg'
    const lastCall = capturedSpinnerCalls[capturedSpinnerCalls.length - 1]
    expect(lastCall.size).toBe('lg')

    // Assert: Spinner was called with className including 'text-primary'
    expect(lastCall.className).toContain('text-primary')
  })
})
