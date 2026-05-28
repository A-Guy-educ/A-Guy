'use client'

/**
 * LessonExercisesEditorButton — admin action button on the lesson edit view
 * that navigates to the lesson exercises editor page.
 *
 * @fileType component
 * @domain lessons
 * @pattern admin-action-button
 * @ai-summary Navigates to a scrollable page listing all exercises of a lesson with inline editing.
 */
import React from 'react'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { useDocumentInfo } from '@payloadcms/ui'

export const LessonExercisesEditorButton: React.FC = () => {
  const { id } = useDocumentInfo()
  if (!id) return null

  return (
    <Link
      href={`/admin/lessons/${id}/exercises`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        fontSize: 13,
        fontWeight: 500,
        border: '1px solid var(--theme-elevation-200)',
        borderRadius: 4,
        backgroundColor: 'var(--theme-elevation-0)',
        color: 'var(--theme-elevation-1000)',
        textDecoration: 'none',
        cursor: 'pointer',
      }}
      title="Edit all lesson exercises in a scrollable list"
    >
      <BookOpen size={14} />
      Edit Exercises
    </Link>
  )
}
