'use client'

import React from 'react'

// Version from package.json - fallback to 'dev' if not available
const VERSION = process.env.NEXT_PUBLIC_APP_VERSION || 'dev'

/**
 * VersionInfo component for admin footer
 * Displays version and build date from package.json and environment
 * @ai-summary Version/build date display for admin footer
 */
export const VersionInfo: React.FC = () => {
  // Read version from environment variable or use fallback
  const version = VERSION

  // Read build date from environment variable or use current date
  const buildDate = process.env.BUILD_DATE || new Date().toISOString().split('T')[0]

  // Format the display string
  const versionDisplay = `v${version}`

  return (
    <div
      className="version-info"
      style={{
        padding: 'var(--base)',
        fontSize: '12px',
        color: 'var(--theme-elevation-400)',
        textAlign: 'center',
        borderTop: '1px solid var(--theme-elevation-100)',
        marginTop: 'auto',
      }}
    >
      <span>{versionDisplay}</span>
      <span style={{ margin: '0 8px' }}>•</span>
      <span>Built {buildDate}</span>
    </div>
  )
}

export default VersionInfo
