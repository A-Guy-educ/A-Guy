/**
 * LessonDuplicationRelationshipCell — displays a lesson relationship in admin list views.
 *
 * Shows the lesson title when the relationship is populated (depth>=1 API response),
 * otherwise falls back to the lesson ID. This prevents the admin UI from showing
 * "Loading..." when the per-row related-document fetch fails or is not configured.
 *
 * @fileType component
 * @domain admin
 * @ai-summary Cell for sourceLesson/outputLesson columns in the LessonDuplications list
 */

'use client'

import React from 'react'

interface LessonRelationshipCellProps {
  cellData?: { id: string; title?: string } | string | null
}

export const LessonDuplicationRelationshipCell: React.FC<LessonRelationshipCellProps> = ({
  cellData,
}) => {
  if (!cellData) {
    return <span style={{ color: 'var(--theme-elevation-400)' }}>—</span>
  }

  // Populated object (depth >= 1 response)
  if (typeof cellData === 'object' && 'id' in cellData) {
    const title = cellData.title
    if (title) {
      return <span title={cellData.id}>{title}</span>
    }
    return <span style={{ color: 'var(--theme-elevation-500)' }}>{cellData.id}</span>
  }

  // ID string (depth=0 response) — show truncated ID as fallback
  const idStr = String(cellData)
  return (
    <span
      title={idStr}
      style={{
        color: 'var(--theme-elevation-600)',
        fontFamily: 'monospace',
        fontSize: 11,
      }}
    >
      {idStr.length > 12 ? `${idStr.slice(0, 12)}…` : idStr}
    </span>
  )
}

export default LessonDuplicationRelationshipCell
