// @vitest-environment jsdom

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import Loading from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/loading'

describe('lesson loading', () => {
  it('should render a spinner with role="status"', () => {
    const { container } = render(<Loading />)

    // Assert an element with role="status" exists (Spinner has role="status")
    const statusElement = container.querySelector('[role="status"]')
    expect(statusElement).toBeTruthy()
  })

  it('should be a valid React component that renders without throwing', () => {
    // This test verifies the component is valid and renders without errors
    const { container } = render(<Loading />)

    // Assert the rendered output contains a container element
    const containerElement = container.querySelector(
      '.flex.items-center.justify-center.min-h-\\[50vh\\]',
    )
    expect(containerElement).toBeTruthy()
  })
})
