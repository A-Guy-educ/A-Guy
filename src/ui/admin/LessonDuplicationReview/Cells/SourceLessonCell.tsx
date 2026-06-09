/**
 * SourceLessonCell — displays the source lesson title in the lesson-duplications list view.
 *
 * Handles both populated relationship objects ({ id, title }) and plain string IDs.
 * Shows "Loading..." only as a fallback when the title cannot be determined.
 *
 * @fileType component
 * @domain admin
 */

'use client'

import React from 'react'

interface LessonRelationshipValue {
  id: string
  title?: string
  [key: string]: unknown
}

interface SourceLessonCellProps {
  cellData?: LessonRelationshipValue | string
  fieldData?: LessonRelationshipValue | string
}

export const SourceLessonCell: React.FC<SourceLessonCellProps> = ({ cellData, fieldData }) => {
  const value = cellData ?? fieldData

  if (!value) {
    return <span className="text-muted-foreground">—</span>
  }

  // If it's a string, we don't have the title (would need an API call)
  if (typeof value === 'string') {
    // Show a truncated ID as fallback since we can't fetch the title client-side
    return (
      <span className="text-body-sm text-muted-foreground" title={value}>
        {value.slice(0, 8)}...
      </span>
    )
  }

  // It's an object — use the title if available
  if (value.title) {
    return <span className="text-body-sm text-card-foreground">{value.title}</span>
  }

  // Object without title — show ID
  return (
    <span className="text-body-sm text-muted-foreground" title={value.id}>
      {value.id.slice(0, 8)}...
    </span>
  )
}

export default SourceLessonCell
