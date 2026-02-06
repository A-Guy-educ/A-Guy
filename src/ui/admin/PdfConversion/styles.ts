import type { CSSProperties } from 'react'

export const cardStyle: CSSProperties = {
  padding: 16,
  backgroundColor: 'var(--theme-elevation-50)',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 4,
}

export const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--theme-elevation-700)',
  marginBottom: 4,
}

export const selectStyle: CSSProperties = {
  width: '100%',
  height: 36,
  padding: '0 10px',
  fontSize: 13,
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 4,
  backgroundColor: 'var(--theme-elevation-0)',
  color: 'var(--theme-elevation-1000)',
  boxSizing: 'border-box' as const,
}

export const inputStyle: CSSProperties = {
  width: '100%',
  height: 36,
  padding: '0 10px',
  fontSize: 13,
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 4,
  backgroundColor: 'var(--theme-elevation-0)',
  color: 'var(--theme-elevation-1000)',
  boxSizing: 'border-box' as const,
}

export const fieldGroupStyle: CSSProperties = {
  marginBottom: 16,
}

export const sectionHeadingStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--theme-elevation-1000)',
  margin: '0 0 16px 0',
}

export const errorBannerStyle: CSSProperties = {
  padding: '8px 12px',
  marginBottom: 12,
  fontSize: 13,
  color: 'var(--theme-error)',
  backgroundColor: 'var(--theme-error-100)',
  borderRadius: 4,
}

export const successBannerStyle: CSSProperties = {
  padding: '8px 12px',
  marginBottom: 12,
  fontSize: 13,
  color: 'var(--theme-success)',
  backgroundColor: 'var(--theme-success-100)',
  borderRadius: 4,
}

export const getBadgeStyle = (status: string): CSSProperties => {
  const map: Record<string, CSSProperties> = {
    queued: { backgroundColor: 'var(--theme-warning-100)', color: 'var(--theme-warning)' },
    running: { backgroundColor: 'var(--theme-info-100)', color: 'var(--theme-info)' },
    completed: { backgroundColor: 'var(--theme-success-100)', color: 'var(--theme-success)' },
    failed: { backgroundColor: 'var(--theme-error-100)', color: 'var(--theme-error)' },
    draft: { backgroundColor: 'var(--theme-elevation-200)', color: 'var(--theme-elevation-700)' },
    published: { backgroundColor: 'var(--theme-success-100)', color: 'var(--theme-success)' },
  }
  return {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: 3,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    ...(map[status] || map.draft),
  }
}

export const dropdownStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 10,
  top: '100%',
  left: 0,
  right: 0,
  marginTop: 4,
  backgroundColor: 'var(--theme-elevation-0)',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 4,
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  maxHeight: 240,
  overflowY: 'auto',
  listStyle: 'none',
  padding: 0,
  margin: 0,
}

export const radioItemStyle: CSSProperties = {
  padding: '8px 12px',
  cursor: 'pointer',
  borderRadius: 3,
  fontSize: 13,
  color: 'var(--theme-elevation-1000)',
}

export const radioItemSelectedStyle: CSSProperties = {
  ...radioItemStyle,
  backgroundColor: 'var(--theme-elevation-100)',
  border: '2px solid var(--theme-elevation-800)',
}

export const jobCardStyle: CSSProperties = {
  padding: 12,
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 4,
  cursor: 'pointer',
  backgroundColor: 'var(--theme-elevation-0)',
}

export const jobCardSelectedStyle: CSSProperties = {
  ...jobCardStyle,
  border: '2px solid var(--theme-elevation-800)',
}

export const progressBarContainerStyle: CSSProperties = {
  width: '100%',
  height: 4,
  backgroundColor: 'var(--theme-elevation-200)',
  borderRadius: 2,
  overflow: 'hidden',
  marginTop: 8,
}

export const progressBarFillStyle: CSSProperties = {
  height: '100%',
  backgroundColor: 'var(--theme-success)',
  borderRadius: 2,
}

export const exerciseCardStyle: CSSProperties = {
  padding: 12,
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 4,
  backgroundColor: 'var(--theme-elevation-0)',
}

export const exerciseTitleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--theme-elevation-1000)',
  marginBottom: 4,
}

export const exerciseMetaStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--theme-elevation-500)',
}
