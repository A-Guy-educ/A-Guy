// @vitest-environment jsdom

import { cleanup, render, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/ui/web/providers/I18n'
import enMessages from '@/i18n/en.json'
import ErrorComponent from '@/app/(frontend)/error'

// Mock Button component
vi.mock('@/ui/web/components/button', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}))

const renderWithI18n = (component: React.ReactElement) => {
  return render(
    <I18nProvider locale="en" messages={enMessages}>
      {component}
    </I18nProvider>,
  )
}

describe('Error Component', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    cleanup()
  })

  it('should render translated title and message', () => {
    const testError = new Error('test error')
    const reset = vi.fn()

    const { getByText } = renderWithI18n(<ErrorComponent error={testError} reset={reset} />)

    expect(getByText('Something went wrong')).toBeTruthy()
    expect(getByText('An unexpected error occurred. Please try again.')).toBeTruthy()
    expect(getByText('Try again')).toBeTruthy()
  })

  it('should call reset() when Try Again button is clicked', () => {
    const testError = new Error('test error')
    const reset = vi.fn()

    const { getByText } = renderWithI18n(<ErrorComponent error={testError} reset={reset} />)

    const button = getByText('Try again')
    fireEvent.click(button)

    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('should include error digest attribute when provided', () => {
    const testError = Object.assign(new Error('test error'), { digest: 'abc123' })
    const reset = vi.fn()

    const { container } = renderWithI18n(<ErrorComponent error={testError} reset={reset} />)

    const errorDiv = container.querySelector('[data-error-digest="abc123"]')
    expect(errorDiv).toBeTruthy()
  })
})
