'use client'

import React from 'react'

// Read version from package.json at build time; allow env override for CI/CD
const packageJson: { version?: string } = require('../../../../package.json') as {
  version?: string
}
const VERSION = process.env.NEXT_PUBLIC_APP_VERSION || packageJson.version || 'dev'

/**
 * VersionInfo — displays the app version and build date in the admin dashboard footer.
 * Reads version from package.json at build time; NEXT_PUBLIC_APP_VERSION overrides when set.
 * Build date is injected at CI/CD build time via BUILD_DATE env var.
 * Renders as muted text on every admin dashboard page.
 *
 * @ai-summary App version and build date display for admin footer
 */
export const VersionInfo: React.FC = () => {
  const buildDate = process.env.BUILD_DATE || new Date().toISOString().split('T')[0]
  const versionDisplay = `v${VERSION}`

  return (
    <div
      className="version-info"
      style={{
        padding: 'var(--base)',
        fontSize: '12px',
        color: 'var(--theme-elevation-400)',
        textAlign: 'center',
        borderTop: '1px solid var(--theme-elevation-100)',
      }}
    >
      <span>{versionDisplay}</span>
      <span style={{ margin: '0 0.5em' }}>·</span>
      <span>Built {buildDate}</span>
    </div>
  )
}

export default VersionInfo
