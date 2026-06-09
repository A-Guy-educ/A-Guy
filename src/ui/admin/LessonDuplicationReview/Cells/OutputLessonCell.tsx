/**
 * OutputLessonCell — displays the output lesson title in the lesson-duplications list view.
 *
 * Handles both populated relationship objects ({ id, title }) and plain string IDs.
 * Shows '<No Output Lesson>' when outputLesson is null (pending records).
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

interface OutputLessonCellProps {
  cellData?: LessonRelationshipValue | string | null
  fieldData?: LessonRelationshipValue | string | null
}

export const OutputLessonCell: React.FC<OutputLessonCellProps> = ({ cellData, fieldData }) => {
  const value = cellData ?? fieldData

  if (value === null || value === undefined) {
    return <span className="text-body-sm text-muted-foreground">&lt;No Output Lesson&gt;</span>
  }

  // If it's a string, we don't have the title (would need an API call)
  if (typeof value === 'string') {
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

export default OutputLessonCell
