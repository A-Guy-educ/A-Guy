/**
 * SourceLessonCell — displays the source lesson title in the lesson-duplications list view.
 *
 * @fileType component
 * @domain admin
 * @ai-summary Renders the source lesson title from a relationship field in the list column
 */

'use client'

import React from 'react'

interface SourceLessonCellProps {
  cellData?: { id: string; title?: string } | string | null
  fieldData?: { id: string; title?: string } | string | null
}

export const SourceLessonCell: React.FC<SourceLessonCellProps> = ({ cellData, fieldData }) => {
  const lesson = cellData || fieldData

  if (!lesson) {
    return <span className="text-muted-foreground">—</span>
  }

  // Handle string ID or populated object
  const label =
    typeof lesson === 'object' && lesson !== null ? lesson.title || lesson.id : String(lesson)

  return <span className="text-body-sm text-foreground truncate max-w-[200px] block">{label}</span>
}

export default SourceLessonCell
