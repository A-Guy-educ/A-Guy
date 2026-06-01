// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { VersionInfo } from '@/ui/admin/VersionInfo'

// Neutralize BUILD_DATE so the test is deterministic
const originalBuildDate = process.env.BUILD_DATE

describe('VersionInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BUILD_DATE = '2026-05-31'
    // Ensure NEXT_PUBLIC_APP_VERSION is not set so we hit the fallback
    delete process.env.NEXT_PUBLIC_APP_VERSION
  })

  afterEach(() => {
    // Restore original BUILD_DATE
    if (originalBuildDate !== undefined) {
      process.env.BUILD_DATE = originalBuildDate
    } else {
      delete process.env.BUILD_DATE
    }
  })

  it('displays version from package.json, not the vdev placeholder', async () => {
    render(<VersionInfo />)

    // The version string must NOT contain 'vdev' (the broken placeholder)
    // Use queryByText which returns null when not found (unlike getByText which throws)
    const versionText = screen.queryByText((content) => {
      return typeof content === 'string' && content.includes('vdev')
    })

    // Assertion: there should be NO element containing 'vdev'
    // If this assertion fails, the component is showing 'vdev' placeholder
    expect(versionText).toBeNull()
  })

  it('displays a properly formatted version string starting with v', async () => {
    render(<VersionInfo />)

    // The version display should match the format v{version} from package.json
    // Expected format: v0.25.10
    const versionElement = screen.getByText((content) => {
      return typeof content === 'string' && /^v\d+\.\d+\.\d+$/.test(content.trim())
    })

    expect(versionElement).toBeTruthy()
  })

  it('displays the build date', async () => {
    render(<VersionInfo />)

    expect(screen.getByText('Built 2026-05-31')).toBeTruthy()
  })
})
