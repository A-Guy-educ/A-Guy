/**
 * LessonRelationshipCell — displays a lesson relationship in admin list view.
 *
 * Shows the lesson title when available (from depth=1 populate),
 * falls back to the lesson ID string.
 *
 * This replaces Payload's default relationship cell which makes an additional
 * API call to /api/lessons/:id and can get stuck in "Loading..." if that
 * call fails for any reason.
 *
 * @fileType component
 * @domain admin
 * @ai-summary Displays lesson relationship title in list view without extra API calls
 */

'use client'

import React from 'react'

interface LessonRelationshipCellProps {
  cellData?: { id: string; title?: string } | string | null
  fieldData?: { id: string; title?: string } | string | null
}

export const LessonRelationshipCell: React.FC<LessonRelationshipCellProps> = ({
  cellData,
  fieldData,
}) => {
  const data = cellData ?? fieldData

  if (!data) {
    return <span className="text-muted-foreground">—</span>
  }

  // Handle populated relationship object
  if (typeof data === 'object' && 'id' in data) {
    const title = data.title
    const id = data.id
    if (title) {
      return <span className="text-body-sm text-card-foreground">{title}</span>
    }
    // No title available, show truncated ID
    return (
      <span className="font-mono text-body-sm text-muted-foreground" title={id}>
        {id.slice(0, 8)}…
      </span>
    )
  }

  // Handle string ID (not populated)
  if (typeof data === 'string') {
    return (
      <span className="font-mono text-body-sm text-muted-foreground" title={data}>
        {data.slice(0, 8)}…
      </span>
    )
  }

  return <span className="text-muted-foreground">—</span>
}
