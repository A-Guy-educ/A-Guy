/**
 * OutputLessonCell — displays the output lesson title in the LessonDuplications list view.
 *
 * Uses cellData directly without making additional fetches, avoiding the "Loading..."
 * indefinitely issue that occurs when Payload's default relationship cell tries to
 * fetch the related document and that request hangs.
 *
 * @fileType component
 * @domain admin
 * @ai-summary Shows output lesson title in list column without hanging fetches
 */

'use client'

import React from 'react'

interface LessonDoc {
  id: string
  title?: string
  [key: string]: unknown
}

interface OutputLessonCellProps {
  cellData?: LessonDoc | string | null
  fieldData?: LessonDoc | string | null
}

const NO_OUTPUT_LESSON = '<No Output Lesson>'

/**
 * Extracts display text from cellData, handling both populated objects and string IDs.
 * No additional fetches are made — displays what Payload already provides.
 */
function getDisplayText(cellData: unknown): string {
  if (cellData == null) return NO_OUTPUT_LESSON
  if (typeof cellData === 'string') return cellData
  if (typeof cellData === 'object') {
    const doc = cellData as LessonDoc
    return doc.title || doc.id
  }
  return String(cellData)
}

export const OutputLessonCell: React.FC<OutputLessonCellProps> = ({ cellData, fieldData }) => {
  const data = cellData ?? fieldData
  const displayText = getDisplayText(data)

  return (
    <span className="text-body-sm text-card-foreground">{displayText || NO_OUTPUT_LESSON}</span>
  )
}

export default OutputLessonCell
