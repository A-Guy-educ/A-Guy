import type { CSSProperties } from 'react'

export const widgetContainerStyle: CSSProperties = {
  marginBottom: 24,
}

export const widgetTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  color: 'var(--theme-elevation-1000)',
  margin: '0 0 16px 0',
}

export const gridStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
}

export const userGridStyle: CSSProperties = {
  ...gridStyle,
  gridTemplateColumns: 'repeat(4, 1fr)',
}

export const contentGridStyle: CSSProperties = {
  ...gridStyle,
  gridTemplateColumns: 'repeat(5, 1fr)',
}

export const metricCardStyle: CSSProperties = {
  padding: 20,
  backgroundColor: 'var(--theme-elevation-50)',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 8,
  position: 'relative',
  overflow: 'hidden',
}

export const metricCardLargeStyle: CSSProperties = {
  ...metricCardStyle,
  padding: 24,
}

export const metricLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--theme-elevation-500)',
  marginBottom: 8,
}

export const metricValueStyle: CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
  color: 'var(--theme-elevation-1000)',
  lineHeight: 1.2,
}

export const metricValueSmallStyle: CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  color: 'var(--theme-elevation-1000)',
  lineHeight: 1.2,
}

export const trendBadgeStyle = (isPositive: boolean): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  marginTop: 8,
  padding: '2px 8px',
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 600,
  backgroundColor: isPositive ? 'var(--theme-success-100)' : 'var(--theme-error-100)',
  color: isPositive ? 'var(--theme-success)' : 'var(--theme-error)',
})

export const iconContainerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 40,
  height: 40,
  borderRadius: 8,
  marginBottom: 12,
}

export const accentBarStyle = (color: string): CSSProperties => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: 3,
  background: color,
})

export const loadingStyle: CSSProperties = {
  padding: 24,
  textAlign: 'center',
  color: 'var(--theme-elevation-500)',
  fontSize: 14,
}

export const errorStyle: CSSProperties = {
  padding: '12px 16px',
  backgroundColor: 'var(--theme-error-100)',
  color: 'var(--theme-error)',
  borderRadius: 8,
  fontSize: 13,
}
