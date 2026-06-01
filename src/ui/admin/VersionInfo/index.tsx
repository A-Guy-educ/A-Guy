'use client'

import React, { useEffect, useState } from 'react'

/**
 * VersionInfo component for admin footer
 * Displays version and build date from package.json via API
 * @ai-summary Version/build date display for admin footer
 */
export const VersionInfo: React.FC = () => {
  const [version, setVersion] = useState<string>('dev')
  const [buildDate, setBuildDate] = useState<string>('')

  useEffect(() => {
    // Fetch version from API (reads from package.json)
    fetch('/api/version')
      .then((res) => res.json())
      .then((data) => setVersion(data.version || 'dev'))
      .catch(() => setVersion('dev'))

    // Build date from environment variable or use current date
    const dateFromEnv = process.env.NEXT_PUBLIC_BUILD_DATE
    setBuildDate(dateFromEnv || new Date().toISOString().split('T')[0])
  }, [])

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
