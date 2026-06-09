'use client'

import React, { useEffect, useState } from 'react'

interface VersionData {
  version: string
  builtAt: string
}

/**
 * VersionInfo — displays the app version in the admin dashboard footer.
 * Fetches from /api/version at runtime to get the current version from package.json.
 * Renders as muted text on every admin dashboard page.
 *
 * @ai-summary App version display for admin footer
 */
export const VersionInfo: React.FC = () => {
  const [versionData, setVersionData] = useState<VersionData | null>(null)

  useEffect(() => {
    fetch('/api/version')
      .then((res) => res.json())
      .then((data: VersionData) => setVersionData(data))
      .catch(() => {
        setVersionData({ version: 'dev', builtAt: 'unknown' })
      })
  }, [])

  if (!versionData) {
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
        <span>v…</span>
      </div>
    )
  }

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
      <span>{`v${versionData.version} • Built ${versionData.builtAt}`}</span>
    </div>
  )
}

export default VersionInfo
