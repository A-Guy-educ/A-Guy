'use client'

import React from 'react'

// Read version from package.json at build time; allow env override for CI/CD
const packageJson: { version?: string } = require('../../../../package.json') as {
  version?: string
}
const VERSION = process.env.NEXT_PUBLIC_APP_VERSION || packageJson.version || 'dev'

/**
 * VersionInfo — displays the app version in the admin dashboard footer.
 * Reads from package.json at build time; NEXT_PUBLIC_APP_VERSION overrides when set.
 * Renders as muted text on every admin dashboard page.
 *
 * @ai-summary App version display for admin footer
 */
export const VersionInfo: React.FC = () => {
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
    </div>
  )
}

export default VersionInfo
