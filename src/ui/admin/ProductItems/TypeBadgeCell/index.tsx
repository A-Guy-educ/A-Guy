'use client'

import React from 'react'

type BadgeType = 'lesson' | 'feature'

const BADGE_STYLES: Record<BadgeType, { background: string; color: string }> = {
  lesson: {
    background: 'var(--theme-success-100, #dcfce7)',
    color: 'var(--theme-success-600, #16a34a)',
  },
  feature: {
    background: 'var(--theme-elevation-200, #e9d5ff)',
    color: 'var(--theme-elevation-700, #7c3aed)',
  },
}

interface TypeBadgeCellProps {
  cellData: BadgeType | undefined
}

export const TypeBadgeCell: React.FC<TypeBadgeCellProps> = ({ cellData }) => {
  if (!cellData) return null

  const styles = BADGE_STYLES[cellData]
  const label = cellData === 'lesson' ? '📚 שיעור' : '⚙️ תכונה'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        ...styles,
      }}
    >
      {label}
    </span>
  )
}

export default TypeBadgeCell
