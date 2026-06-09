/**
 * OutputLessonCell — displays the output lesson title in the lesson-duplications list view.
 *
 * Shows '<No Output Lesson>' when the output lesson is not yet set (e.g., pending/running records).
 *
 * @fileType component
 * @domain admin
 * @ai-summary Renders the output lesson title or a placeholder when null
 */

'use client'

import React from 'react'

interface OutputLessonCellProps {
  cellData?: { id: string; title?: string } | string | null
  fieldData?: { id: string; title?: string } | string | null
}

export const OutputLessonCell: React.FC<OutputLessonCellProps> = ({ cellData, fieldData }) => {
  const lesson = cellData || fieldData

  if (!lesson || lesson === null) {
    return <span className="text-muted-foreground italic">&lt;No Output Lesson&gt;</span>
  }

  // Handle string ID or populated object
  const label =
    typeof lesson === 'object' && lesson !== null ? lesson.title || lesson.id : String(lesson)

  return <span className="text-body-sm text-foreground truncate max-w-[200px] block">{label}</span>
}

export default OutputLessonCell
