// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'

// Mock the package.json require call — actual version from package.json
vi.mock('../../../../package.json', () => ({
  default: { version: '0.25.8' },
}))

const originalEnv = { ...process.env }

describe('VersionInfo', () => {
  beforeEach(() => {
    vi.resetModules()
    // Restore env vars, clear override
    process.env = { ...originalEnv }
    delete process.env.NEXT_PUBLIC_APP_VERSION
  })

  afterEach(() => {
    process.env = originalEnv
    cleanup()
  })

  it('should render version from package.json when env var is not set', async () => {
    vi.resetModules()
    const { VersionInfo } = await import('@/ui/admin/VersionInfo')
    render(<VersionInfo />)
    expect(screen.getByText('v0.25.8')).toBeTruthy()
  })

  it('should prefer NEXT_PUBLIC_APP_VERSION over package.json version', async () => {
    process.env.NEXT_PUBLIC_APP_VERSION = '1.2.3'
    vi.resetModules()
    const { VersionInfo } = await import('@/ui/admin/VersionInfo')
    render(<VersionInfo />)
    expect(screen.getByText('v1.2.3')).toBeTruthy()
  })

  it('should not render a build date string', async () => {
    vi.resetModules()
    const { VersionInfo } = await import('@/ui/admin/VersionInfo')
    const { container } = render(<VersionInfo />)
    expect(container.textContent).not.toMatch(/Built \d{4}-\d{2}-\d{2}/)
  })
})
