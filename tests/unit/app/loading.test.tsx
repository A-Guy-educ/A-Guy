// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/ui/web/providers/I18n'
import enMessages from '../../../src/i18n/en.json'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: new URLSearchParams(),
}))

const renderWithI18n = (component: React.ReactElement) => {
  return render(
    <I18nProvider locale="en" messages={enMessages}>
      {component}
    </I18nProvider>,
  )
}

describe('Loading component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Spinner with translated accessible label', async () => {
    const Loading = (await import('@/app/(frontend)/loading')).default
    renderWithI18n(<Loading />)

    // Spinner should have role="status"
    const spinner = document.querySelector('[role="status"]')
    expect(spinner).not.toBeNull()
    expect(spinner?.getAttribute('aria-label')).toBe('Loading...')
  })

  it('renders visible loading text', async () => {
    const Loading = (await import('@/app/(frontend)/loading')).default
    renderWithI18n(<Loading />)

    // Check that the visible text (not sr-only) is rendered
    const loadingText = document.querySelector('p.text-sm')
    expect(loadingText).not.toBeNull()
    expect(loadingText?.textContent).toBe('Loading...')
  })

  it('is a client component', () => {
    const fs = require('fs')
    const path = require('path')
    const filePath = path.resolve(__dirname, '../../../src/app/(frontend)/loading.tsx')
    const fileContent = fs.readFileSync(filePath, 'utf-8')

    // First non-empty line should be 'use client'
    const firstLine = fileContent.trim().split('\n')[0].trim()
    expect(firstLine).toBe("'use client'")
  })
})
