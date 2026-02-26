// @vitest-environment jsdom

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import Loading from '@/app/(frontend)/loading'

describe('frontend loading', () => {
  it('should render a spinner with role="status" and aria-label="Loading"', () => {
    const { container } = render(<Loading />)

    // Assert an element with role="status" exists (the Spinner component has role="status")
    const statusElement = container.querySelector('[role="status"]')
    expect(statusElement).toBeTruthy()

    // Assert an element with aria-label="Loading" exists
    const loadingElement = container.querySelector('[aria-label="Loading"]')
    expect(loadingElement).toBeTruthy()
  })
})
