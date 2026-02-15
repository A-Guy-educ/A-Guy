# Build: 260214-version-info-footer

## 2026-02-14 13:50 - Component Implementation

### Files Created

**1. VersionInfo Component**

- **File:** `src/ui/admin/VersionInfo/index.tsx`
- **Type:** Client component ('use client')

**Component Features:**

- Reads version from `package.json` (imports as raw)
- Reads build date from `process.env.BUILD_DATE` (falls back to current date)
- Formats as: "v0.9.0 • Built 2026-02-14"
- Styled to match Payload admin theme using CSS variables
- Uses `marginTop: 'auto'` to push to bottom of container

**2. Payload Config Update**

- **File:** `src/payload.config.ts`
- Added `VersionInfo` to `admin.components.beforeDashboard` array

### Code Summary

```tsx
'use client'

import packageJson from '../../../../package.json?raw'

export const VersionInfo: React.FC = () => {
  const version = packageJson.version || 'dev'
  const buildDate = process.env.BUILD_DATE || new Date().toISOString().split('T')[0]
  const versionDisplay = `v${version}`

  return (
    <div className="version-info" style={{...}}>
      <span>{versionDisplay}</span>
      <span>•</span>
      <span>Built {buildDate}</span>
    </div>
  )
}
```

### Environment Variables Needed

```bash
BUILD_DATE=2026-02-14
```

_Note: Version is automatically read from package.json version property (currently 0.9.0)_

### Integration

The component is added to the `beforeDashboard` slot in Payload admin config, which displays on the admin dashboard welcome area.

**Status:** ✅ COMPLETE
